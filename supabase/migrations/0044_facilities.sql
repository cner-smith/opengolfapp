-- Facilities: a parent over courses. A "unit" is a course row (9-hole loop or
-- standalone 18). facility_id null = standalone independent course (the norm).
create table public.facilities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  city       text,
  state      text,
  lat        double precision,
  lng        double precision,
  created_at timestamptz not null default now()
);
alter table public.facilities enable row level security;

-- SELECT-only for anon/authenticated; all writes are service-role only.
-- Intentionally STRICTER than courses (which permits rate-limited authenticated
-- INSERT). No client facility-write path exists in P1; add one only if introduced.
create policy facilities_read on public.facilities
  for select using (true);

alter table public.courses
  add column facility_id uuid references public.facilities(id) on delete set null,
  add column unit_name   text,
  add column unit_order  integer;

create index courses_facility_id_idx on public.courses (facility_id);
