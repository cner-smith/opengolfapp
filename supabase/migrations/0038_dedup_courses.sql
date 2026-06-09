-- 0038_dedup_courses.sql  (#470)
--
-- Targeted dedup of TRUE duplicate course rows — NOT a wipe-and-reimport.
-- Triage (prod, 2026-06-08) showed the crawler's upsert-on-external_id (0019)
-- already prevents re-import duplication (external_id dup groups = 0), so a
-- re-crawl would reproduce the same rows. The actual rot is ~238 rows (1.5%)
-- that are genuine duplicates: same normalized name AND same ~1km location.
--
-- CLUSTER KEY: lower(btrim(name)) + round(lat,2) + round(lng,2).
--   ~0.01deg ≈ 1.1km. Conservative on purpose — it will NOT merge two distinct
--   courses that happen to share a generic name in different towns (those have
--   different rounded coords). Known under-merge cases it won't catch:
--     • the same course straddling a rounding boundary (35.004 vs 35.006)
--     • spelling variants ("St. Andrews" vs "St Andrews")
--   Under-merging is the safe direction (leaves a dup rather than fusing two
--   real courses). Re-runnable, so a second pass can mop up boundary cases.
--
-- SURVIVOR per cluster (row_number rn=1), in priority order:
--   1. has external_id   — keeps the crawler-canonical row so future crawls
--                          converge instead of re-creating the dup
--   2. most holes        — keeps the richest geometry
--   3. has city + state  — most complete for search/display
--   4. lowest id         — deterministic final tiebreak
--   ⚠ POLICY DECISION: (1) before (2) means a cluster whose external_id'd row
--     has FEWER holes than a loser will keep the sparser geometry. Run the
--     "data-loss preflight" below before applying; if any cluster flags, decide
--     per-cluster or flip the ordering (holes before external_id).
--
-- FK handling (delete rules verified on prod 2026-06-08):
--   holes.course_id        → courses  CASCADE   (loser's holes auto-deleted)
--   course_tees.course_id  → courses  CASCADE   (loser's tees auto-deleted)
--   rounds.course_id       → courses  NO ACTION (blocks delete → repoint first)
--   rounds.course_tee_id   → tees     NO ACTION (blocks if a round cites a
--                                                 loser's tee → guarded below)
--   hole_scores.hole_id    → holes    NO ACTION (a loser hole cascade-delete is
--                                                 blocked if a round scored it)
-- On prod, rounds_on_losers = 0, so the repoint is a no-op there; it exists to
-- satisfy #470's acceptance criterion ("existing rounds still resolve to a
-- valid course") on dev / any future data.

-- Mapping of every loser → its cluster survivor. Temp; dropped at end.
create temporary table _dedup_map as
with ranked as (
  select
    c.id,
    lower(btrim(c.name)) || '|' ||
      round(c.lat::numeric, 2) || '|' ||
      round(c.lng::numeric, 2) as k,
    row_number() over (
      partition by lower(btrim(c.name)) || '|' ||
        round(c.lat::numeric, 2) || '|' ||
        round(c.lng::numeric, 2)
      order by
        (c.external_id is not null) desc,
        (select count(*) from public.holes h where h.course_id = c.id) desc,
        (c.city is not null and c.state is not null) desc,
        c.id
    ) as rn
  from public.courses c
  where c.lat is not null and c.lng is not null
),
clustered as (
  select id, k, rn from ranked
  where k in (select k from ranked group by k having count(*) > 1)
)
select l.id as loser_id, s.id as survivor_id
from clustered l
join clustered s on s.k = l.k and s.rn = 1
where l.rn > 1;

-- 1. Preserve user rounds: repoint any round on a loser to its survivor.
update public.rounds r
set course_id = m.survivor_id
from _dedup_map m
where r.course_id = m.loser_id;

-- 2. Delete losers. holes + course_tees cascade. Guard: never delete a loser
--    whose tee is still cited by a round (rounds.course_tee_id NO ACTION would
--    abort the whole migration). Such a row stays for a manual follow-up.
delete from public.courses c
using _dedup_map m
where c.id = m.loser_id
  and not exists (
    select 1
    from public.course_tees ct
    join public.rounds r on r.course_tee_id = ct.id
    where ct.course_id = c.id
  );

drop table _dedup_map;

-- ───────────────────────────────────────────────────────────────────────────
-- PREFLIGHT (run manually on dev BEFORE applying — not part of the migration):
--
-- -- a) How many losers / clusters, and the round-safety check (want 0):
-- with ranked as (
--   select c.id,
--     lower(btrim(c.name))||'|'||round(c.lat::numeric,2)||'|'||round(c.lng::numeric,2) k,
--     row_number() over (partition by
--       lower(btrim(c.name))||'|'||round(c.lat::numeric,2)||'|'||round(c.lng::numeric,2)
--       order by (c.external_id is not null) desc,
--         (select count(*) from public.holes h where h.course_id=c.id) desc,
--         (c.city is not null and c.state is not null) desc, c.id) rn
--   from public.courses c where c.lat is not null and c.lng is not null),
-- cl as (select id,k,rn from ranked where k in
--   (select k from ranked group by k having count(*)>1))
-- select
--   (select count(*) from cl where rn>1) losers,
--   (select count(*) from public.rounds where course_id in (select id from cl where rn>1)) rounds_on_losers;
--
-- -- b) DATA-LOSS flag: clusters where the chosen survivor has fewer holes than
-- --    a loser being deleted (review these before applying):
-- --    (same ranked/cl CTEs as above, then:)
-- -- select s.id survivor, (select count(*) from holes where course_id=s.id) surv_holes,
-- --        l.id loser,   (select count(*) from holes where course_id=l.id) lose_holes
-- -- from cl l join cl s on s.k=l.k and s.rn=1
-- -- where l.rn>1 and (select count(*) from holes where course_id=l.id)
-- --                > (select count(*) from holes where course_id=s.id);
-- ───────────────────────────────────────────────────────────────────────────
