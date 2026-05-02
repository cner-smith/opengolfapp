-- DB-level validation for handicap and par. Without these, a poisoned
-- handicap (e.g. -50) flows into the SG calculation producing NaN or
-- the wrong handicap bracket. Par values outside 3-6 are physically
-- impossible on a real course.
--
-- Range note: -10 covers the lowest plus-handicaps (PGA tour scratch is
-- around -8); 54 is the WHS maximum.
alter table public.profiles
  add constraint handicap_range
  check (handicap_index is null or handicap_index between -10 and 54);

-- The original `holes` table already constrains par via
--   par int not null check (par between 3 and 6)
-- in 0001_initial_schema.sql, so re-asserting it here is redundant but
-- harmless and serves as documentation alongside the new profile constraint.
alter table public.holes
  drop constraint if exists par_range;
alter table public.holes
  add constraint par_range
  check (par between 3 and 6);
