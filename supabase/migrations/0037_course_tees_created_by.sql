-- #222: attribute course_tees to their creator and tighten write policies.
--
-- 0008 left INSERT open to ANY authenticated user with no attribution; 0014
-- locked UPDATE to service_role. The clients (web useCourses, mobile
-- round/new) only upsert tees immediately after creating a NEW course — there
-- are no pre-existing rows to collide with, and the write is explicitly
-- best-effort. So: add a created_by owner (defaulting to the inserting user)
-- and allow a user to write only their OWN tees; service_role (the crawler)
-- keeps full access. No client change is needed — the existing inserts omit
-- created_by, so the column default supplies it.

alter table public.course_tees
  add column created_by uuid
    references public.profiles(id) on delete set null
    default auth.uid();

-- INSERT: a user may only create rows attributed to themselves (the default
-- fills created_by = auth.uid(); an explicit mismatched created_by is
-- rejected). service_role (auth.uid() null) inserts crawler rows freely.
drop policy if exists "Authenticated users can insert course tees" on public.course_tees;
create policy "Users insert own course tees"
  on public.course_tees for insert
  with check (auth.role() = 'service_role' or auth.uid() = created_by);

-- UPDATE: owner or service_role. Replaces the service_role-only policy from
-- 0014 so a user can still correct a tee they created.
drop policy if exists "Service role can update course tees" on public.course_tees;
create policy "Users update own course tees"
  on public.course_tees for update
  using (auth.role() = 'service_role' or auth.uid() = created_by);
