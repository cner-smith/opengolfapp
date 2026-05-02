-- Performance indexes surfaced by the postgres-pro audit. Each one targets
-- a query pattern that currently does a heap fetch / filesort / seqscan
-- and will hurt at scale (1000+ users, 10000+ rounds).
--
-- All four use IF NOT EXISTS so the migration is safe to re-run against a
-- partially-applied environment.

-- 1. hole_scores RLS policy uses
--      EXISTS (SELECT 1 FROM rounds WHERE id = round_id AND user_id = auth.uid())
--    The PK index covers `id` alone, forcing a heap fetch for the user_id
--    check on every matched row. INCLUDE (user_id) puts user_id in the
--    index leaf so the planner can satisfy the policy index-only.
create index if not exists rounds_id_user_covering
  on public.rounds(id) include (user_id);

-- 2. getShotsByClub filters on (user_id, club) AND `aim_lat IS NOT NULL`
--    AND `end_lat IS NOT NULL`, then orders by created_at DESC. Existing
--    shots_club_user_idx is (user_id, club) only — sort spills to disk
--    and null-coordinate rows still get scanned. A partial composite
--    that pre-filters nulls and pre-sorts created_at lets the planner
--    serve the patterns page index-only on the filter + sort.
create index if not exists shots_club_created_partial
  on public.shots(user_id, club, created_at desc)
  where aim_lat is not null and end_lat is not null;

-- 3. getDrills filters drills.skill_levels (text[]) with `.contains([level])`,
--    which translates to the @> operator. Without a GIN index this is a
--    seqscan on every drill-picker render.
create index if not exists drills_skill_levels_gin
  on public.drills using gin(skill_levels);

-- 4. Trigram index on courses.name to back the fuzzy course search work
--    queued in #60. Created here so the index is in place before the
--    feature lands; pg_trgm is a built-in Postgres extension on Supabase.
create extension if not exists pg_trgm;

create index if not exists courses_name_trgm
  on public.courses using gin(name gin_trgm_ops);
