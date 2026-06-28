-- ============================================================================
-- Autocaddie · Phase 1 schema — Part 1: identity & durable crews
-- Durable-persistence model (Phase 2 build prompt §2.5, folded into Phase 1):
--   profiles  : public profile per auth user (accounts + anonymous guests)
--   crews     : durable roster that persists ACROSS rounds (NOT a tee Group)
--   players   : durable participant identity; managed (no login) OR linked to a
--               real account. Replaces per-round free-text guest names.
-- RLS: crew-scoped — a crew member (and owner) may read the crew's roster.
-- Anonymous-auth guests are role `authenticated` and fully supported.
-- ============================================================================

-- ── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  email         text,
  handicap_index numeric(4,1),          -- e.g. 8.2; manual entry (GHIN deferred)
  ghin_number   text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-create a profile when an auth user (account or anonymous) is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name',
             nullif(split_part(coalesce(new.email,''),'@',1),''))
  )
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── crews ───────────────────────────────────────────────────────────────────
create table public.crews (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.crew_members (
  crew_id    uuid not null references public.crews(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create index on public.crew_members (user_id);

-- Owner is auto-enrolled as a crew member on creation.
create or replace function public.handle_new_crew()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.crew_members (crew_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end; $$;

create trigger on_crew_created
  after insert on public.crews
  for each row execute function public.handle_new_crew();

-- SECURITY DEFINER so policies can call it without recursing through RLS.
create or replace function public.is_crew_member(p_crew_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.crew_members cm
    where cm.crew_id = p_crew_id and cm.user_id = auth.uid()
  );
$$;

-- ── players (durable, managed-vs-linked) ─────────────────────────────────────
-- linked_user_id = null  ⇒ MANAGED player (no login; you score for them; durable;
--                          can be linked to a real account later)
-- linked_user_id = <uid> ⇒ LINKED to a real account
create table public.players (
  id             uuid primary key default gen_random_uuid(),
  crew_id        uuid references public.crews(id) on delete cascade,   -- null for crewless/owner-scoped
  owner_user_id  uuid not null references auth.users(id) on delete cascade,
  display_name   text not null,
  handicap_index numeric(4,1),
  linked_user_id uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on public.players (crew_id);
create index on public.players (owner_user_id);
create index on public.players (linked_user_id);

-- ── friendships ─────────────────────────────────────────────────────────────
create table public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at   timestamptz not null default now(),
  unique (requester_id, addressee_id)
);

-- ── round_templates (Home "regular games" one-tap) ──────────────────────────
create table public.round_templates (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  crew_id       uuid references public.crews(id) on delete set null,
  name          text not null,
  default_group jsonb,
  default_games jsonb,
  created_at    timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.crews           enable row level security;
alter table public.crew_members    enable row level security;
alter table public.players         enable row level security;
alter table public.friendships     enable row level security;
alter table public.round_templates enable row level security;

-- profiles: a user manages their own profile.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- crews: members read; owner (creator) writes.
create policy crews_select_member on public.crews
  for select to authenticated using (public.is_crew_member(id) or created_by = auth.uid());
create policy crews_insert_own on public.crews
  for insert to authenticated with check (created_by = auth.uid());
create policy crews_update_owner on public.crews
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy crews_delete_owner on public.crews
  for delete to authenticated using (created_by = auth.uid());

-- crew_members: members see the roster; only the crew owner adds/removes.
create policy crew_members_select on public.crew_members
  for select to authenticated using (public.is_crew_member(crew_id));
create policy crew_members_insert_owner on public.crew_members
  for insert to authenticated
  with check (exists (select 1 from public.crews c where c.id = crew_id and c.created_by = auth.uid()));
create policy crew_members_delete_owner on public.crew_members
  for delete to authenticated
  using (exists (select 1 from public.crews c where c.id = crew_id and c.created_by = auth.uid()));

-- players: crew members manage the crew roster; owner manages owner-scoped players;
-- a linked user can see their own linked player.
create policy players_select on public.players
  for select to authenticated
  using (owner_user_id = auth.uid() or linked_user_id = auth.uid()
         or (crew_id is not null and public.is_crew_member(crew_id)));
create policy players_insert on public.players
  for insert to authenticated
  with check (owner_user_id = auth.uid()
              and (crew_id is null or public.is_crew_member(crew_id)));
create policy players_update on public.players
  for update to authenticated
  using (owner_user_id = auth.uid() or (crew_id is not null and public.is_crew_member(crew_id)))
  with check (owner_user_id = auth.uid() or (crew_id is not null and public.is_crew_member(crew_id)));
create policy players_delete on public.players
  for delete to authenticated
  using (owner_user_id = auth.uid() or (crew_id is not null and public.is_crew_member(crew_id)));

-- friendships: either party can see/manage.
create policy friendships_select on public.friendships
  for select to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy friendships_insert on public.friendships
  for insert to authenticated with check (requester_id = auth.uid());
create policy friendships_update on public.friendships
  for update to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy friendships_delete on public.friendships
  for delete to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());

-- round_templates: owner only.
create policy round_templates_all on public.round_templates
  for all to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
