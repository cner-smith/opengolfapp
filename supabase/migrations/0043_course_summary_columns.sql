-- Course summary columns: derived hole_count / total_par / total_yards, plus a
-- needs_remap flag for under-mapped courses. The three summaries are derived
-- deterministically from holes here; needs_remap is set by a separate one-off
-- backfill against validated hole counts (external data, not reproducible here).

alter table public.courses
  add column if not exists hole_count  integer,
  add column if not exists total_par   integer,
  add column if not exists total_yards integer,
  add column if not exists needs_remap boolean not null default false;

-- Deterministic backfill from holes. total_yards is only meaningful when every
-- hole carries a yardage, so leave it null if any hole is missing one.
update public.courses c
set hole_count  = h.cnt,
    total_par   = h.par_sum,
    total_yards = case when h.yards_missing = 0 then h.yards_sum else null end
from (
  select course_id,
         count(*)                              as cnt,
         sum(par)                              as par_sum,
         sum(yards)                            as yards_sum,
         count(*) filter (where yards is null) as yards_missing
  from public.holes
  group by course_id
) h
where c.id = h.course_id;
