-- 0061: insert_shot, the inverse of delete_shot (#1114).
--
-- A played hole's "Add a shot" inserts a shot after an existing one. The
-- shots after it move up one number and the hole score goes up by one, in one
-- transaction so a dropped connection can't leave a gap or a stale score. The
-- composite unique (hole_score_id, shot_number) is deferrable (0046), so the
-- shift can't trip on a transient duplicate.
--
-- The new row carries only its start and distance to the pin: the player drags
-- it into place and the review fills in the rest. A plain row is one stroke, so
-- putts and penalties are untouched. Idempotent on the client-generated id: a
-- retry after a lost response returns false and changes nothing.
create or replace function public.insert_shot(
  p_id uuid,
  p_after_shot_id uuid,
  p_start_lat double precision,
  p_start_lng double precision,
  p_distance_to_target int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_owner uuid;
  v_hs uuid;
  v_num int;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select user_id, hole_score_id, shot_number
    into v_owner, v_hs, v_num
    from public.shots
    where id = p_after_shot_id;
  if not found then
    raise exception 'shot not found';
  end if;
  if v_owner <> v_uid then
    raise exception 'forbidden';
  end if;

  if exists (select 1 from public.shots where id = p_id) then
    return false;
  end if;

  update public.shots
    set shot_number = shot_number + 1
    where hole_score_id = v_hs and shot_number > v_num;

  insert into public.shots (id, hole_score_id, user_id, shot_number, start_lat, start_lng, distance_to_target)
    values (p_id, v_hs, v_uid, v_num + 1, p_start_lat, p_start_lng, p_distance_to_target);

  update public.hole_scores set score = score + 1 where id = v_hs;

  return true;
end;
$$;

revoke execute on function public.insert_shot(uuid, uuid, double precision, double precision, int) from public, anon;
grant  execute on function public.insert_shot(uuid, uuid, double precision, double precision, int) to authenticated;
