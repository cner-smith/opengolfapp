-- #1326: an 18-hole round on a 9-hole course plays holes 1-9 twice. hole_scores
-- needs a holes row per round hole (UNIQUE (round_id, hole_id)), so holes 10-18
-- stay rows, but on a course whose courses.hole_count is 9 they are marked as
-- repeats: loop_of = the front-nine hole they replay, with its par, yards and
-- geometry copied. Everything that reads a course's own hole count skips them,
-- so the course keeps reading as a 9.
-- Only courses.hole_count = 9 without needs_remap qualifies (0043: needs_remap marks
-- courses whose validated count is higher than their mapped holes). A course mapped
-- through hole 9 with no count may be half of an 18, and copying hole 1's map onto
-- its hole 10 would be wrong. Known gap: the crawler doesn't write hole_count, so
-- courses crawled after 0043 (count null) keep the old behaviour until it does.

alter table public.holes
  add column loop_of uuid references public.holes(id) on delete cascade;

comment on column public.holes.loop_of is
  'Set on holes 10-18 of a 9-hole course (courses.hole_count = 9, not needs_remap): the hole this one replays (#1326).';

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
  v_front public.holes%rowtype;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- Caller must own the round they're materializing the hole for.
  if not exists (
    select 1 from public.rounds r
    where r.id = p_round_id
      and r.user_id = v_user_id
      and r.course_id = p_course_id
  ) then
    raise exception 'not authorized';
  end if;

  if p_par < 3 or p_par > 6 then
    raise exception 'par must be between 3 and 6';
  end if;
  if p_number < 1 or p_number > 18 then
    raise exception 'number must be between 1 and 18';
  end if;

  -- The second time round a 9-hole course: replay the front-nine hole.
  if p_number > 9 and exists (
    select 1 from public.courses c where c.id = p_course_id and c.hole_count = 9 and not c.needs_remap
  ) then
    select * into v_front from public.holes
    where course_id = p_course_id and number = p_number - 9 and loop_of is null;
  end if;

  if v_front.id is not null then
    insert into public.holes (course_id, number, par, stroke_index, yards, tee_lat, tee_lng, pin_lat, pin_lng, par_source, loop_of)
    values (p_course_id, p_number, v_front.par, p_number, v_front.yards, v_front.tee_lat, v_front.tee_lng,
            v_front.pin_lat, v_front.pin_lng, v_front.par_source, v_front.id)
    on conflict (course_id, number) do nothing
    returning id into v_hole_id;
  else
    insert into public.holes (course_id, number, par, stroke_index)
    values (p_course_id, p_number, p_par, p_number)
    on conflict (course_id, number) do nothing
    returning id into v_hole_id;
  end if;

  -- ON CONFLICT DO NOTHING returns NULL on conflict — fetch the existing row.
  if v_hole_id is null then
    select id into v_hole_id
    from public.holes
    where course_id = p_course_id
      and number = p_number;
  end if;

  return v_hole_id;
end;
$$;
