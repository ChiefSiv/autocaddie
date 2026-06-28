-- ============================================================================
-- Autocaddie · Phase 1 schema — Part 3: events, play, durable ledger
-- Event → Group → Player hierarchy (multi-group ready; MVP UI is single-group).
--   events        : a round/gathering; belongs to a Crew (nullable = crewless one-off)
--   event_members : auth users with access to an event (host + guests who joined by code)
--   groups        : a tee group WITHIN an event (scoring_mode solo|live) — NOT a Crew
--   round_players : references a durable Player (player_id) — NEVER a free-text name
--   games         : scope event|group; stakes off by default
--   hole_scores   : one row per player per hole; strokes nullable (pick-up); RETAINED
--   ledger_entries: settle-up result written to a durable, crew-scoped ledger
-- RLS: event-scoped (members read/write within an event; accounts via auth.uid(),
--   guests join via join_code → become event_members) + crew-scoped ledger.
-- ============================================================================

-- ── events ───────────────────────────────────────────────────────────────────
create table public.events (
  id            uuid primary key default gen_random_uuid(),
  host_user_id  uuid not null references auth.users(id) on delete cascade,
  crew_id       uuid references public.crews(id) on delete set null,  -- null = crewless one-off (no ledger accrual)
  course_id     uuid references public.courses(id) on delete set null,
  tee_set_id    uuid references public.tee_sets(id) on delete set null,
  date          date,
  join_code     text unique,
  status        text not null default 'setup' check (status in ('setup','active','completed','archived')),
  holes_to_play int  not null default 18 check (holes_to_play in (9, 18)),
  which_nine    text check (which_nine in ('front','back')),       -- for 9-hole rounds
  starting_hole int  check (starting_hole between 1 and 18),        -- shotgun starts
  allowance_mode text not null default 'full' check (allowance_mode in ('full','relative')), -- ROUND-LEVEL setting
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.events (crew_id);
create index on public.events (host_user_id);

create table public.event_members (
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'player' check (role in ('host','player','spectator')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index on public.event_members (user_id);

-- Host auto-enrolled as an event member on creation.
create or replace function public.handle_new_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.event_members (event_id, user_id, role)
  values (new.id, new.host_user_id, 'host') on conflict do nothing;
  return new;
end; $$;
create trigger on_event_created
  after insert on public.events
  for each row execute function public.handle_new_event();

-- Short, unambiguous join code (no 0/O/1/I), auto-assigned if not supplied.
create or replace function public.gen_join_code()
returns text language plpgsql as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text := ''; i int;
begin
  for i in 1..5 loop
    code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return code;
end; $$;

create or replace function public.set_event_join_code()
returns trigger language plpgsql security definer set search_path = public as $$
declare c text; tries int := 0;
begin
  if new.join_code is null then
    loop
      c := public.gen_join_code();
      exit when not exists (select 1 from public.events where join_code = c);
      tries := tries + 1;
      if tries > 20 then raise exception 'could not allocate join code'; end if;
    end loop;
    new.join_code := c;
  end if;
  return new;
end; $$;
create trigger events_set_join_code
  before insert on public.events
  for each row execute function public.set_event_join_code();

-- is_event_member: member via event_members OR via the event's crew.
create or replace function public.is_event_member(p_event_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
           select 1 from public.event_members em
           where em.event_id = p_event_id and em.user_id = auth.uid()
         )
      or exists (
           select 1 from public.events e
           where e.id = p_event_id and e.crew_id is not null
             and public.is_crew_member(e.crew_id)
         );
$$;

-- ── groups (tee group within an event) ───────────────────────────────────────
create table public.groups (
  id                  uuid primary key default gen_random_uuid(),
  event_id            uuid not null references public.events(id) on delete cascade,
  name                text,
  scoring_mode        text not null default 'solo' check (scoring_mode in ('solo','live')),
  scorekeeper_user_id uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index on public.groups (event_id);

create or replace function public.can_access_group(p_group_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_event_member((select event_id from public.groups where id = p_group_id));
$$;

create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

-- round_players reference a DURABLE player_id, carrying this round's handicaps.
create table public.round_players (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.groups(id) on delete cascade,
  player_id       uuid not null references public.players(id) on delete restrict,
  handicap_index  numeric(4,1),  -- snapshot for this round
  course_handicap int,           -- computed by the engine
  playing_handicap int,          -- computed by the engine (allowance applied)
  team_id         uuid references public.teams(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (group_id, player_id)
);
create index on public.round_players (group_id);
create index on public.round_players (player_id);

create table public.games (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  scope          text not null default 'group' check (scope in ('event','group')),
  group_id       uuid references public.groups(id) on delete cascade,
  type           text not null check (type in ('skins','nassau','match')),
  config         jsonb not null default '{}'::jsonb,   -- e.g. sides for match/nassau, carryover flag
  stakes_enabled boolean not null default false,        -- Social by default
  stake          numeric(10,2),
  allowance      numeric(4,3) not null default 1.0,     -- format allowance (e.g. 0.85), separate from event allowance_mode
  gross_or_net   text not null default 'net' check (gross_or_net in ('gross','net')),
  created_at     timestamptz not null default now()
);
create index on public.games (event_id);

-- one HoleScore row per player per hole; strokes null = picked up / no score.
create table public.hole_scores (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references public.groups(id) on delete cascade,
  round_player_id uuid not null references public.round_players(id) on delete cascade,
  hole_number     int not null check (hole_number between 1 and 18),
  strokes         int check (strokes >= 1),   -- null = pick up / no score
  entered_by      uuid references auth.users(id) on delete set null,
  version         int not null default 1,     -- last-write-wins on (updated_at, version)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (group_id, round_player_id, hole_number)
);
create index on public.hole_scores (round_player_id);

create table public.game_results (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references public.games(id) on delete cascade,
  round_player_id uuid references public.round_players(id) on delete cascade,
  net_amount      numeric(10,2) not null default 0,   -- 0 when stakes off
  detail          jsonb not null default '{}'::jsonb, -- standings (skins won, match status, ...)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.game_results (game_id);

create table public.settlements (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  combined   jsonb not null default '{}'::jsonb,  -- net-per-player + minimized txns + per-game breakdown
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.settlements (event_id);

-- Durable, crew-scoped ledger. A per-player season-to-date net is SUM(amount).
-- crew_id is NOT NULL → crewless one-offs simply never write ledger entries.
create table public.ledger_entries (
  id         uuid primary key default gen_random_uuid(),
  crew_id    uuid not null references public.crews(id) on delete cascade,
  event_id   uuid references public.events(id) on delete set null,
  player_id  uuid not null references public.players(id) on delete cascade,
  amount     numeric(10,2) not null,   -- signed net (+ won / − owed)
  paid       boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.ledger_entries (crew_id);
create index on public.ledger_entries (player_id);

-- Guests/accounts join an event by code → become an event member (then normal
-- event-scoped RLS applies). SECURITY DEFINER so it can insert past RLS safely.
create or replace function public.join_event_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_event_id uuid;
begin
  if auth.uid() is null then raise exception 'must be authenticated'; end if;
  select id into v_event_id from public.events where join_code = upper(p_code);
  if v_event_id is null then raise exception 'invalid join code'; end if;
  insert into public.event_members (event_id, user_id, role)
  values (v_event_id, auth.uid(), 'player') on conflict do nothing;
  return v_event_id;
end; $$;
grant execute on function public.join_event_by_code(text) to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.events         enable row level security;
alter table public.event_members  enable row level security;
alter table public.groups         enable row level security;
alter table public.teams          enable row level security;
alter table public.round_players  enable row level security;
alter table public.games          enable row level security;
alter table public.hole_scores    enable row level security;
alter table public.game_results   enable row level security;
alter table public.settlements    enable row level security;
alter table public.ledger_entries enable row level security;

-- events: members read; host writes.
create policy events_select on public.events
  for select to authenticated using (public.is_event_member(id));
create policy events_insert_host on public.events
  for insert to authenticated with check (host_user_id = auth.uid());
create policy events_update_host on public.events
  for update to authenticated using (host_user_id = auth.uid()) with check (host_user_id = auth.uid());
create policy events_delete_host on public.events
  for delete to authenticated using (host_user_id = auth.uid());

-- event_members: members read; host manages (joining goes through the RPC).
create policy event_members_select on public.event_members
  for select to authenticated using (public.is_event_member(event_id));
create policy event_members_insert_host on public.event_members
  for insert to authenticated
  with check (exists (select 1 from public.events e where e.id = event_id and e.host_user_id = auth.uid()));
create policy event_members_delete_host on public.event_members
  for delete to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.host_user_id = auth.uid()));

-- Event-scoped read/write for the round's structure & scores.
create policy groups_all on public.groups
  for all to authenticated using (public.is_event_member(event_id)) with check (public.is_event_member(event_id));
create policy teams_all on public.teams
  for all to authenticated using (public.can_access_group(group_id)) with check (public.can_access_group(group_id));
create policy round_players_all on public.round_players
  for all to authenticated using (public.can_access_group(group_id)) with check (public.can_access_group(group_id));
create policy games_all on public.games
  for all to authenticated using (public.is_event_member(event_id)) with check (public.is_event_member(event_id));
create policy hole_scores_all on public.hole_scores
  for all to authenticated using (public.can_access_group(group_id)) with check (public.can_access_group(group_id));
create policy game_results_all on public.game_results
  for all to authenticated
  using (public.is_event_member((select event_id from public.games g where g.id = game_id)))
  with check (public.is_event_member((select event_id from public.games g where g.id = game_id)));
create policy settlements_all on public.settlements
  for all to authenticated using (public.is_event_member(event_id)) with check (public.is_event_member(event_id));

-- ledger_entries: crew-scoped (spans multiple events within a crew).
create policy ledger_entries_all on public.ledger_entries
  for all to authenticated using (public.is_crew_member(crew_id)) with check (public.is_crew_member(crew_id));

-- ── Grants (RLS still gates rows; these grant table-level access to the roles) ─
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
