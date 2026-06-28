-- ============================================================================
-- Autocaddie · Phase 1 schema — Part 2: course data (cache-on-first-use)
-- Course data is fetched once via the CourseDataProvider and PERSISTED here so
-- all play reads from our DB (offline + API-cost control). Par + per-hole
-- stroke index + slope/rating are the make-or-break fields.
-- RLS: cached reference data is readable by any authenticated user; writes
-- (cache + manual add/edit fallback) are allowed for authenticated users.
-- Single-tenant personal app — permissive writes are acceptable; see CONTEXT.md.
-- ============================================================================

create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  provider    text not null default 'golfcourseapi',  -- which CourseDataProvider supplied it
  external_id text,                                    -- provider's course id
  name        text not null,
  location    text,
  city        text,
  state       text,
  country     text,
  lat         double precision,
  lng         double precision,
  created_by  uuid references auth.users(id) on delete set null,  -- set for manual entries
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (provider, external_id)
);
create index on public.courses (name);

create table public.tee_sets (
  id         uuid primary key default gen_random_uuid(),
  course_id  uuid not null references public.courses(id) on delete cascade,
  name       text not null,                 -- e.g. "Blue"
  gender     text,                          -- optional: mens/womens rating set
  rating     numeric(4,1),                  -- course rating
  slope      int check (slope between 55 and 155),
  par        int,
  created_at timestamptz not null default now()
);
create index on public.tee_sets (course_id);

create table public.holes (
  id           uuid primary key default gen_random_uuid(),
  tee_set_id   uuid not null references public.tee_sets(id) on delete cascade,
  number       int not null check (number between 1 and 18),
  par          int not null check (par between 3 and 6),
  stroke_index int check (stroke_index between 1 and 18),  -- SI 1 = hardest
  yardage      int,
  unique (tee_set_id, number)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.courses  enable row level security;
alter table public.tee_sets enable row level security;
alter table public.holes    enable row level security;

-- Readable by all authenticated users (shared cache).
create policy courses_select  on public.courses  for select to authenticated using (true);
create policy tee_sets_select on public.tee_sets for select to authenticated using (true);
create policy holes_select    on public.holes    for select to authenticated using (true);

-- Writable by authenticated users (cache-on-first-use + manual add/edit).
create policy courses_write  on public.courses  for all to authenticated using (true) with check (true);
create policy tee_sets_write on public.tee_sets for all to authenticated using (true) with check (true);
create policy holes_write    on public.holes    for all to authenticated using (true) with check (true);
