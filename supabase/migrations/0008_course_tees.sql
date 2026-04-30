-- Per-course tee box ratings used to compute USGA-style score
-- differentials (and from those, the rolling handicap index). One row
-- per (course, tee_color) pair; NULL ratings are tolerated so user-
-- created or partial OpenGolfAPI imports can land before someone fills
-- in the rating + slope.
create table public.course_tees (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  tee_color text not null,
  tee_name text,
  course_rating numeric(4, 1),
  slope_rating integer check (
    slope_rating is null or slope_rating between 55 and 155
  ),
  total_yards integer,
  par integer,
  created_at timestamptz not null default now(),
  unique (course_id, tee_color)
);

-- Round → tee link plus the computed differential per round so the
-- handicap index can be recalculated by averaging the best of the
-- last 20 differentials.
alter table public.rounds
  add column course_tee_id uuid references public.course_tees(id),
  add column score_differential numeric(5, 2);

-- ---------------------------------------------------------------------------
-- RLS — public read, authenticated insert. Update/delete reserved for the
-- creator (no creator column on this table yet, so allow updates from any
-- authenticated user; tighten in a future migration if needed).
-- ---------------------------------------------------------------------------
alter table public.course_tees enable row level security;

create policy "Anyone can read course tees"
  on public.course_tees for select
  using (true);

create policy "Authenticated users can insert course tees"
  on public.course_tees for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update course tees"
  on public.course_tees for update
  using (auth.role() = 'authenticated');

create index if not exists idx_course_tees_course_id
  on public.course_tees(course_id);
