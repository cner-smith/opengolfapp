-- Hole curation writes go through an authorized RPC (closes #710, #721).
--
-- `holes` has RLS with only SELECT + INSERT policies — no UPDATE policy
-- exists in 0001–0039. An UPDATE under RLS with zero policies filters to
-- 0 rows and PostgREST returns success with `error: null`, so every par
-- correction and auto-persisted tee coordinate silently no-op'd for every
-- user, including the course creator.
--
-- Rather than an open UPDATE policy on a shared table, curation goes
-- through `update_hole_curation(...)` (SECURITY DEFINER, matching the
-- `insert_synthetic_hole` ownership shape): only the crowd-curation
-- columns (par, tee_lat, tee_lng) are writable, and the caller must own
-- a round on the hole's course — round-scoped authorization, same
-- auditable trail the INSERT path requires.

create or replace function public.update_hole_curation(
  p_hole_id uuid,
  p_round_id uuid,
  p_par integer default null,
  p_tee_lat double precision default null,
  p_tee_lng double precision default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- Cap par to the table's CHECK range so a malformed payload returns
  -- a clean error instead of tripping the constraint deep in the function.
  if p_par is not null and (p_par < 3 or p_par > 6) then
    raise exception 'par must be between 3 and 6';
  end if;

  -- Caller must own a round on the same course as the hole they're
  -- curating. Stops a malicious client from editing arbitrary holes by
  -- passing any owned round id — the round has to reference the hole's
  -- course, and rounds.user_id is RLS-scoped.
  if not exists (
    select 1 from public.rounds r
    join public.holes h on h.id = p_hole_id and h.course_id = r.course_id
    where r.id = p_round_id
      and r.user_id = v_user_id
  ) then
    raise exception 'not authorized';
  end if;

  update public.holes set
    par = coalesce(p_par, par),
    tee_lat = coalesce(p_tee_lat, tee_lat),
    tee_lng = coalesce(p_tee_lng, tee_lng)
  where id = p_hole_id;
end;
$$;

revoke all on function public.update_hole_curation(uuid, uuid, integer, double precision, double precision) from public;
grant execute on function public.update_hole_curation(uuid, uuid, integer, double precision, double precision) to authenticated;

-- #721: insert_synthetic_hole's own comment claims the round must be on
-- the target course, but the check was never implemented — any owned
-- round authorized hole inserts on any public course. Add the one-line
-- `r.course_id = p_course_id` predicate; body otherwise identical to 0026.

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
      and r.course_id = p_course_id
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
