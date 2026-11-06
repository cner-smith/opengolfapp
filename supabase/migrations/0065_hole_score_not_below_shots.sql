-- A hole's score can't be set below the number of shots logged on it (#1332).
-- Every shot row is at least one stroke (0054: struck rows + one more per OB
-- row), so score >= row count always holds for a correct hole. A phone whose
-- cached round predates shots logged elsewhere can still send a stale score
-- patch (e.g. 1 over 4 shots); prod had 5 such holes on 2026-11-03.
--
-- Only a CHANGE of score is checked: existing rows stay as they are, and the
-- shot RPCs are unaffected (delete_shot deletes before it lowers the score,
-- insert_shot inserts before it raises it). The error is check_violation
-- (23514): mobile sync treats class 23 as permanent and drops the patch
-- (sync.ts isPermanentError), web shows the error.
create or replace function public.hole_score_not_below_shots()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if new.score is null then
    return new;
  end if;
  select count(*) into v_rows from public.shots where hole_score_id = new.id;
  if new.score < v_rows then
    raise exception 'hole score % is below its % logged shots', new.score, v_rows
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger hole_scores_not_below_shots
  before update of score on public.hole_scores
  for each row
  when (new.score is distinct from old.score)
  execute function public.hole_score_not_below_shots();
