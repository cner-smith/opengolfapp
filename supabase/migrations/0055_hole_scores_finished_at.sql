-- When the player finished the hole in a live round — the resume point's
-- signal after an app restart (#902). hole_scores.score can't say it: live
-- mode rewrites a running score on every shot, so a hole with one shot
-- already read as played and resume skipped past it. Nullable and additive;
-- rows from before this migration (and from builds that don't write it)
-- resume on the last hole with shots.
alter table public.hole_scores
  add column if not exists finished_at timestamptz;
