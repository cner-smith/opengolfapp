-- 0054: delete_shot drops TWO strokes for an OB row, not one.
--
-- A stroke-and-distance penalty (tee/fairway shot goes OB, replay from the
-- original spot) costs two strokes but the replay swing has no shot row of
-- its own — see #839. The struck shot that went OB is the ONE row in
-- `shots`; the penalty stroke it incurs is invisible to the schema. So a
-- hole's score is `struck rows + (count of OB rows)`: every row contributes
-- its own stroke, and an `ob = true` row additionally contributes the
-- rowless penalty stroke. Deleting an OB row must therefore remove BOTH —
-- its own stroke and the penalty stroke that rode along with it — or the
-- hole score is left one stroke too high forever.
--
-- This does NOT extend to the separate `penalty` flag (a non-OB penalty,
-- e.g. a lateral/unplayable drop where the recovery swing is its own
-- logged row): that flag only affects the strokes-gained baseline
-- (`penalty || ob` in @oga/core's sg-calculator/stats), never the score
-- count. A `penalty = true, ob = false` row still represents exactly one
-- physical stroke, so its deletion still drops the score by one. Widening
-- the 2-stroke drop to `penalty or ob` here would double-decrement a
-- penalty shot whose stroke was never double-counted going in.
--
-- Everything else about the function is unchanged from 0046: same auth
-- guard, same ownership check, same idempotent not-found return, same
-- delete + renumber under the deferrable composite unique constraint, same
-- putts/fairway_hit/gir re-tally, same security definer + grants. The only
-- edit is computing the score decrement from `ob` alone instead of the
-- hardcoded `- 1`.
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
  v_is_ob boolean;
  v_remaining int;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select user_id, hole_score_id, shot_number,
         (lie_type = 'green'), (penalty or ob), coalesce(ob, false)
    into v_owner, v_hs, v_num, v_is_putt, v_penal, v_is_ob
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

  -- An OB row is worth two strokes (the swing + its rowless
  -- stroke-and-distance penalty); every other row, including a plain
  -- `penalty` row, is worth one. See house comment above.
  update public.hole_scores set
      score       = greatest(0, coalesce(score, 0) - (case when v_is_ob then 2 else 1 end)),
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
