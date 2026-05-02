-- Two storage / audit-quality cleanups from the DBA + postgres-pro audit.
--
-- 1. Lat/lng columns were declared bare `numeric` (arbitrary precision,
--    18 bytes per value, blocks the planner from making accurate
--    row-size estimates). GPS coordinates need no more than ~7 decimal
--    places; double precision (8 bytes, IEEE 754 float64) is the
--    canonical type for geo coordinates and halves storage per row.
--
--    Tables touched: courses, holes, hole_scores, shots. Postgres
--    rebuilds dependent indexes (incl. shots_club_created_partial from
--    0015) automatically on ALTER COLUMN TYPE.
--
-- 2. profiles had no updated_at column. handicap, skill_level,
--    distance_unit, etc. all mutate; with no timestamp there's no way
--    to detect a stale cache row or audit a recent change. Adds the
--    column + a generic update_updated_at() trigger function (named
--    generically so future tables can reuse it without a per-table
--    function).

-- ---------------------------------------------------------------------------
-- 1. lat/lng → double precision
-- ---------------------------------------------------------------------------
alter table public.courses
  alter column lat type double precision,
  alter column lng type double precision;

alter table public.holes
  alter column tee_lat type double precision,
  alter column tee_lng type double precision,
  alter column pin_lat type double precision,
  alter column pin_lng type double precision;

alter table public.hole_scores
  alter column pin_lat type double precision,
  alter column pin_lng type double precision;

alter table public.shots
  alter column start_lat type double precision,
  alter column start_lng type double precision,
  alter column end_lat type double precision,
  alter column end_lng type double precision,
  alter column aim_lat type double precision,
  alter column aim_lng type double precision;

-- ---------------------------------------------------------------------------
-- 2. profiles.updated_at + generic trigger
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();
