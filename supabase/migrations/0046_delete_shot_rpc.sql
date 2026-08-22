-- 0046: delete_shot RPC — atomic shot delete + renumber + hole_scores re-tally.
-- The composite unique (hole_score_id, shot_number) is made DEFERRABLE so the
-- renumber decrement can shift multiple rows in one statement without a
-- transient duplicate tripping the constraint mid-statement (Postgres does not
-- guarantee UPDATE row order). It cannot be ALTERed to DEFERRABLE in place, so
-- drop + re-add. This does NOT affect any existing upsert: every shots upsert
-- arbitrates onConflict:'id' (the PK), never this composite.
alter table public.shots
  drop constraint shots_hole_score_id_shot_number_key;
alter table public.shots
  add constraint shots_hole_score_id_shot_number_key
  unique (hole_score_id, shot_number) deferrable initially deferred;

create or replace function public.delete_shot(p_shot_id uuid)
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
  v_is_putt boolean;
  v_penal boolean;
  v_remaining int;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select user_id, hole_score_id, shot_number,
         (lie_type = 'green'), (penalty or ob)
    into v_owner, v_hs, v_num, v_is_putt, v_penal
    from public.shots
    where id = p_shot_id;
  if not found then
    return false; -- already gone; idempotent
  end if;
  if v_owner <> v_uid then
    raise exception 'forbidden';
  end if;

  delete from public.shots where id = p_shot_id;

  update public.shots
    set shot_number = shot_number - 1
    where hole_score_id = v_hs and shot_number > v_num;

  select count(*) into v_remaining
    from public.shots where hole_score_id = v_hs;

  update public.hole_scores set
      score       = greatest(0, coalesce(score, 0) - 1),
      putts       = greatest(0, coalesce(putts, 0) - (case when v_is_putt then 1 else 0 end)),
      penalties   = greatest(0, coalesce(penalties, 0) - (case when v_penal then 1 else 0 end)),
      fairway_hit = case when v_remaining = 0 then null else fairway_hit end,
      gir         = case when v_remaining = 0 then null else gir end
    where id = v_hs;

  return true;
end;
$$;

revoke execute on function public.delete_shot(uuid) from public, anon;
grant  execute on function public.delete_shot(uuid) to authenticated;
