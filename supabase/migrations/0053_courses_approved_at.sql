-- Gate user-submitted courses behind approval.
--
-- Before this migration the SELECT policy on `courses` was `using (true)` —
-- any authenticated user could INSERT a course and it was immediately visible
-- to everyone, with no review step. 24 such rows existed at time of writing
-- (all `created_by` set, `external_id` null), from 20 submitters, 22 of them
-- in the preceding 30 days.
--
-- After this migration a submitted course is visible only to its submitter
-- until `approved_at` is stamped. Approval is service-role work; rejection is
-- deleting the row. There is no status enum — a nullable timestamp is the
-- whole queue state.
--
-- No client code changes accompany this. RLS does the filtering, so every
-- existing course query on web and mobile stops returning unapproved rows for
-- other users automatically, while the submitter keeps seeing their own via
-- the `created_by = auth.uid()` branch (preserving "add my home course and
-- play it right now").
--
-- THREE THINGS THIS MIGRATION MUST GET RIGHT, each found in review:
--
--   1. Future crawler inserts. The backfill below only approves rows that
--      exist right now. `scripts/crawl/db-writer.ts` never sets `approved_at`
--      and inserts with `created_by` null, so without the trigger below every
--      newly crawled course would be invisible to everyone — the same
--      "all courses vanish" failure, deferred to the next crawl.
--
--   2. `created_by` is the gate's entire trust signal and was client-writable.
--      The old INSERT policy only checked `auth.uid() is not null`, so a user
--      could post `created_by: null` (forging crawler provenance) or another
--      user's uuid (spoofing attribution). Fixed with the `0037` pattern
--      already proven on `course_tees`: a default plus an equality check.
--
--   3. `approved_at` was likewise client-writable — a user could self-approve
--      by posting a timestamp. The INSERT policy now requires it to be null
--      for non-service-role callers.
--
-- KNOWN, SIGNED-OFF LIMITATION: `holes`, `course_tees` and `hole_tees` remain
-- publicly readable and carry tee/pin coordinates. So this gate hides a
-- pending course's NAME and METADATA, but anyone holding its `course_id` can
-- still read where it physically is. Accepted deliberately — a golf course's
-- location is not secret and gating those tables would put an EXISTS subquery
-- on the two largest tables in the schema (170k holes, 40k tees). Revisit if
-- pending content ever becomes genuinely sensitive.

-- ---------------------------------------------------------------------------
-- Column
-- ---------------------------------------------------------------------------

-- Nullable, no default: adding a nullable column without a default does not
-- rewrite the table, so this is cheap against ~20.7k rows. `if not exists`
-- keeps the file re-runnable, per the convention 0015 established.
alter table public.courses add column if not exists approved_at timestamptz;

comment on column public.courses.approved_at is
  'When this course became globally visible. NULL = pending review, visible only to its submitter (see the SELECT policy). Crawler rows are stamped automatically by the courses_stamp_service_role_approval trigger; existing rows were grandfathered by migration 0053.';

-- Attribution default, mirroring 0037 on course_tees. For service_role
-- (the crawler) auth.uid() is null, so crawler rows keep created_by null —
-- which is exactly what distinguishes them from user submissions.
alter table public.courses alter column created_by set default auth.uid();

-- ---------------------------------------------------------------------------
-- Backfill — THE DANGEROUS STEP
-- ---------------------------------------------------------------------------
--
-- Two groups are approved:
--   1. Crawler courses (`created_by is null`) — the existing corpus. If this
--      predicate were ever mistyped, every course in the app would go
--      invisible at once, so the row count is asserted rather than trusted.
--      Expected 20,733.
--   2. User-submitted courses that already have a round logged by someone
--      OTHER than the submitter — someone else demonstrably played it, so it
--      is self-evidently real and hiding it would break that user's round
--      history. Expected 1.
--
-- Expected post-state: 20,734 approved, 23 pending.
--
-- `now()` is honest here: these rows are approved *as of this migration*.
-- Using `created_at` would falsely imply a human reviewed them back then.
do $$
declare
  approved_count bigint;
begin
  update public.courses
     set approved_at = now()
   where created_by is null
      or exists (
           select 1
             from public.rounds r
            where r.course_id = courses.id
              and r.user_id <> courses.created_by
         );

  get diagnostics approved_count = row_count;

  -- A correct run approves ~20.7k rows. Anything far below that means the
  -- predicate is wrong (a stray AND, a dropped clause in a rebase) and would
  -- hide the corpus from every user. Fail the migration instead of shipping it.
  if approved_count < 20000 then
    raise exception
      'Backfill approved only % course rows; expected >20000. Predicate is wrong — aborting migration.',
      approved_count;
  end if;

  raise notice 'Backfill approved % course rows.', approved_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Keep future crawler inserts visible  (review finding 1)
-- ---------------------------------------------------------------------------
--
-- Keyed on auth.role(), NOT on `created_by is null`. That distinction is
-- load-bearing: keying on created_by would let any client forge crawler
-- provenance by posting created_by: null and be auto-approved instantly,
-- defeating the whole gate. Only a genuine service_role connection qualifies.
create or replace function public.courses_stamp_service_role_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.role() = 'service_role' and new.approved_at is null then
    new.approved_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists courses_stamp_service_role_approval on public.courses;
create trigger courses_stamp_service_role_approval
  before insert on public.courses
  for each row
  execute function public.courses_stamp_service_role_approval();

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- Bound the DDL wait. DROP/CREATE POLICY take ACCESS EXCLUSIVE on courses;
-- because lock requests queue FIFO, waiting behind one long-running SELECT
-- would stall every course read app-wide until it finished. Fail fast and
-- retry instead.
set local lock_timeout = '2s';

-- SELECT: approved rows are public; a submitter always sees their own.
-- Anonymous callers have auth.uid() null, so `created_by = auth.uid()`
-- evaluates NULL and only approved rows are returned. service_role bypasses
-- RLS entirely and is unaffected.
drop policy if exists "Anyone can read courses" on public.courses;
create policy "Read approved courses or your own"
  on public.courses
  for select
  using (approved_at is not null or created_by = auth.uid());

-- INSERT: replaces the old `auth.uid() is not null` check, which let a client
-- choose its own provenance and approval state. A user may now only create a
-- row attributed to themselves and only in the pending state; posting
-- created_by: null, another user's uuid, or any approved_at is rejected
-- (`auth.uid() = null` evaluates NULL, not true). service_role inserts freely.
drop policy if exists "Authenticated users can add courses" on public.courses;
create policy "Users insert own pending courses"
  on public.courses
  for insert
  with check (
    auth.role() = 'service_role'
    or (auth.uid() = created_by and approved_at is null)
  );

-- UPDATE and DELETE deliberately remain without policies: editing and removing
-- courses stay service_role-only, which is also what makes approval and
-- rejection privileged operations. Do not add an owner-update policy without a
-- product reason — a user being able to set their own approved_at would defeat
-- this migration entirely.

-- Verification (run manually after applying; not part of the migration):
--
--   select count(*) filter (where approved_at is not null) as approved,
--          count(*) filter (where approved_at is null)     as pending,
--          count(*)                                        as total
--     from courses;
--
-- Expected at time of writing: approved 20734, pending 23, total 20757.
