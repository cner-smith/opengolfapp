-- Designates one course_tees row per course as "primary" — the tee whose
-- data effectively IS the base `holes` row (par/yards/stroke_index/tee
-- location), rather than a separate unlabeled "Base" concept in the Course
-- Editor. Courses with no tees yet (or no primary chosen) still fall back
-- to editing `holes` directly — this column just lets the UI show that as
-- a real tee once one exists.
alter table public.course_tees
  add column is_primary boolean not null default false;

-- At most one primary tee per course. Two sequential UPDATEs (clear all,
-- then set one) never violate this mid-operation since Postgres checks
-- constraints per-statement, not across the two round trips.
create unique index course_tees_one_primary_per_course
  on public.course_tees (course_id)
  where is_primary;
