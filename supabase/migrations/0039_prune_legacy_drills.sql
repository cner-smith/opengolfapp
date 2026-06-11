-- Prune the legacy pre-v2 drills that predate the curated corpus (0034 v2
-- data + 0035 v1 corpus). An older seed.sql seeded an original ~40-drill set
-- (0030 only added the `source`/`verified` columns); the v2 corpus was loaded
-- alongside those rows with a non-null `source`, so the originals were never
-- removed. On prod that left the drill library at 149 instead of the intended
-- 125.
--
-- The leftovers are uniquely identified by `source IS NULL AND verified =
-- false` — every curated drill carries a non-null source. Verified at write:
--   prod: 149 total, 24 with source IS NULL  -> removes those 24 (→ 125)
--   dev:  125 total,  0 with source IS NULL  -> no-op
-- A fresh DB has no drills until seed.sql runs (which now carries the 125-drill
-- v2 corpus), so this delete is a harmless no-op on a clean migrate.
--
-- Practice plans store drill ids in a jsonb `drills.sessions[].blocks[].drill_id`
-- (no FK), so a deleted id can't cascade — the Practice UI already null-guards a
-- missing drill (PR #544), and the plan generator only draws from verified
-- drills, so a live plan referencing one of these is unlikely.
delete from public.drills
where source is null and verified = false;
