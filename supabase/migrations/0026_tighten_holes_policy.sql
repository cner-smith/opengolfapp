-- Tighten holes INSERT — security audit (closes #220).
--
-- Migration 0001 created the policy "Course creators can insert holes"
-- with `OR c.created_by IS NULL` in the WITH CHECK. With 15K+ crawler-
-- imported rows where `created_by IS NULL`, any authenticated user could
-- insert hole rows for those courses and poison tee/pin coords for
-- everyone. New policy strips the NULL fallback.
--
-- Synthetic-holes / `ensureRealHole` callers used to rely on the open
-- policy for materializing crawler courses. They now go through
-- `insert_synthetic_hole(...)` (SECURITY DEFINER) below, which bypasses
-- RLS but checks that the caller owns the round before inserting.

drop policy if exists "Course creators can insert holes" on public.holes;
drop policy if exists "Users can insert holes for own courses" on public.holes;

create policy "Users can insert holes for own courses"
  on public.holes for insert
  with check (
    exists (
      select 1 from public.courses c
      where c.id = holes.course_id
        and c.created_by = auth.uid()
    )
  );

create or replace function public.insert_synthetic_hole(
  p_course_id uuid,
  p_number integer,
  p_par integer,
  p_round_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hole_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- Caller must own the round they're materializing the hole for.
  -- Stops a malicious client from inserting holes for arbitrary courses
  -- by passing a course_id they don't own — they'd still need a round
  -- on that course, and rounds.user_id is RLS-scoped.
  if not exists (
    select 1 from public.rounds r
    where r.id = p_round_id
      and r.user_id = v_user_id
  ) then
    raise exception 'not authorized';
  end if;

  -- Cap par to the table's CHECK range so a malformed payload returns
  -- a clean error instead of tripping the constraint deep in the function.
  if p_par < 3 or p_par > 6 then
    raise exception 'par must be between 3 and 6';
  end if;
  if p_number < 1 or p_number > 18 then
    raise exception 'number must be between 1 and 18';
  end if;

  insert into public.holes (course_id, number, par, stroke_index)
  values (p_course_id, p_number, p_par, p_number)
  on conflict (course_id, number) do nothing
  returning id into v_hole_id;

  -- ON CONFLICT DO NOTHING returns NULL on conflict — fetch the
  -- existing row so the caller always gets a real id.
  if v_hole_id is null then
    select id into v_hole_id
    from public.holes
    where course_id = p_course_id
      and number = p_number;
  end if;

  return v_hole_id;
end;
$$;

revoke all on function public.insert_synthetic_hole(uuid, integer, integer, uuid) from public;
grant execute on function public.insert_synthetic_hole(uuid, integer, integer, uuid) to authenticated;
