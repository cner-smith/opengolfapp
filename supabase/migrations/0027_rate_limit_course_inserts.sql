-- Rate-limit user-submitted courses — security/spam audit (closes #221).
--
-- Migration 0001's INSERT policy on `courses` allows any authenticated
-- user to insert unlimited rows. Migration 0014 added CHECK constraints
-- on `name` (length + charset) to block the worst injection-shaped
-- strings, but a single signed-up user can still write thousands of
-- spam course rows that appear in every other user's fuzzy course
-- search (migration 0018).
--
-- This migration caps non-service-role inserts at:
--   - 10 per user per hour
--   - 50 per user per day
-- Service-role inserts (the OSM/OpenGolfAPI crawler and any future
-- Edge Functions) bypass the check.
--
-- Mechanism: a `course_submissions` ledger table records every
-- non-service-role insert via a BEFORE INSERT trigger on `courses`.
-- The trigger counts recent rows in the ledger and raises if the
-- caller exceeds either window. We don't FK the ledger to courses
-- (the courses row doesn't exist yet at BEFORE-INSERT time), and we
-- don't store course_id (the user-visible blast radius is purely
-- about volume; per-course attribution belongs in the `created_by`
-- column already on courses).

create table public.course_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Trigger reads rows by (user_id, created_at desc) within hour/day
-- windows on every insert; the composite index keeps the lookup at
-- ~O(log n) instead of a full scan as the ledger grows.
create index course_submissions_user_created_idx
  on public.course_submissions (user_id, created_at desc);

alter table public.course_submissions enable row level security;

-- Users can read their own ledger so a future UI can show
-- "you've submitted N courses today, K remaining". No other policies
-- — inserts happen exclusively through the trigger below (security
-- definer bypasses RLS), and there's never a reason for a client to
-- write or update this table directly.
create policy "Users read own submissions"
  on public.course_submissions for select
  using (auth.uid() = user_id);

create or replace function public.rate_limit_course_inserts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hour_count int;
  day_count int;
begin
  -- service_role bypass: crawler pipeline and Edge Functions
  -- (anything running with the service-role JWT) skip the cap. The
  -- crawler legitimately writes thousands of rows in a single run.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'course insertion requires an authenticated user'
      using errcode = '42501';
  end if;

  select count(*) into hour_count
    from public.course_submissions
    where user_id = auth.uid()
      and created_at > now() - interval '1 hour';

  if hour_count >= 10 then
    raise exception 'rate_limit_exceeded: max 10 course submissions per hour'
      using errcode = '42501';
  end if;

  select count(*) into day_count
    from public.course_submissions
    where user_id = auth.uid()
      and created_at > now() - interval '1 day';

  if day_count >= 50 then
    raise exception 'rate_limit_exceeded: max 50 course submissions per day'
      using errcode = '42501';
  end if;

  insert into public.course_submissions (user_id) values (auth.uid());
  return new;
end;
$$;

create trigger courses_rate_limit_before_insert
  before insert on public.courses
  for each row
  execute function public.rate_limit_course_inserts();
