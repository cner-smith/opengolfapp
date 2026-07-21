-- Lock down courses.facility_id / unit_name / unit_order — facilities-feature
-- security review (0044 follow-up).
--
-- THE HOLE: 0044 added facility_id/unit_name/unit_order to `courses` but the
-- courses INSERT policy from 0001 is still just
--   with check (auth.uid() is not null)
-- with no column restriction, and 0044's `facilities` table is publicly
-- readable (`facilities_read using (true)`), so every facility's id is
-- discoverable. Any authenticated user can therefore INSERT a `courses` row
-- carrying a real facility_id + an arbitrary unit_name (or unit_order), and
-- it renders inside that facility's card for every user — spoofing /
-- defacement of a curated grouping. There is currently no UPDATE policy on
-- `courses` at all (no policy = no client UPDATE access under RLS), so the
-- live exposure is INSERT-only today; this migration still closes UPDATE in
-- case a future courses-UPDATE policy is added without re-deriving this
-- guard from scratch.
--
-- unit_name also had no length/charset constraint — same "publicly-readable,
-- user-writable text" class of exposure 0014 closed for courses.name.
--
-- MECHANISM CHOICE: a BEFORE INSERT OR UPDATE trigger on `courses`, not a
-- revised RLS WITH CHECK. Reasons:
--   1. Single point of enforcement. An RLS fix would mean tightening the
--      INSERT policy's WITH CHECK *and* remembering to repeat the same
--      predicate in any UPDATE policy added later (none exists today — see
--      above). A trigger enforces the invariant independent of how many
--      policies eventually govern writes to this table, so a future
--      "users can update own courses" policy can't silently reopen this.
--   2. Precedent on this exact table: 0027's `rate_limit_course_inserts`
--      trigger already guards `courses` INSERT this way, using the same
--      `auth.role() = 'service_role'` bypass idiom for the crawler /
--      backfill scripts. This keeps the two guards consistent and
--      reviewable side by side.
-- Tradeoff accepted: a trigger fires on every row regardless of which
-- policy let the statement through, and (unlike RLS) doesn't silently
-- filter — a blocked write raises a hard Postgres error. That's the
-- desired behavior here (fail loud on a spoofing attempt) but is a
-- slightly bigger footprint than a narrow WITH CHECK tweak.
--
-- BYPASS: `auth.role() = 'service_role'` (Edge Functions / any future
-- service-role script going through PostgREST — same as the crawler) OR
-- `auth.role() is null` (a direct Postgres connection with no PostgREST
-- request context, e.g. `supabase db push` migrations or the SQL editor —
-- inherently a higher trust level than the anon/authenticated roles this
-- guard targets). The facilities backfill script
-- (scripts/facilities/backfill-facilities.cjs) connects via supabase-js
-- with SUPABASE_SERVICE_ROLE_KEY, so it satisfies the service_role branch.
--
-- unit_order is included alongside facility_id/unit_name even though the
-- prompt driving this migration only named the latter two: it's the same
-- curated-only column added in the same 0044 ALTER TABLE, controls display
-- order *within* a spoofed facility card, and costs nothing extra to guard.

create or replace function public.guard_courses_facility_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- service_role (Edge Functions, backfill/crawler scripts via PostgREST)
  -- and direct Postgres connections (migrations, SQL editor — no JWT
  -- request context at all) are trusted; everyone else goes through the
  -- checks below.
  if auth.role() = 'service_role' or auth.role() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.facility_id is not null or new.unit_name is not null or new.unit_order is not null then
      raise exception
        'facility_id/unit_name/unit_order are curated fields and cannot be set on insert'
        using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.facility_id is distinct from old.facility_id
      or new.unit_name is distinct from old.unit_name
      or new.unit_order is distinct from old.unit_order
    then
      raise exception
        'facility_id/unit_name/unit_order are curated fields and cannot be changed'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists courses_guard_facility_columns on public.courses;

create trigger courses_guard_facility_columns
  before insert or update on public.courses
  for each row
  execute function public.guard_courses_facility_columns();

-- unit_name is publicly readable (rendered on every facility card) and, pre
-- this migration's trigger, was directly user-writable — same exposure
-- class 0014 closed for courses.name. Mirror that pattern: allow NULL
-- (most courses aren't part of a facility), bound length, and block
-- HTML/template-shaped strings.
alter table public.courses
  add constraint courses_unit_name_length
    check (unit_name is null or char_length(unit_name) between 1 and 100),
  add constraint courses_unit_name_chars
    check (unit_name is null or unit_name ~ '^[^<>{}]*$');
