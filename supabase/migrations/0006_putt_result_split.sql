-- Putt result splits into two independent axes — distance (short/long)
-- and direction (left/right). Either or both can be null; "made" stays
-- on the existing putt_result column for back-compat. Old single-value
-- putt_result is preserved by the writer (e.g. 'made' / 'short' / etc.)
-- so existing reads keep working until consumers migrate.
alter table public.shots
  add column putt_distance_result text check (
    putt_distance_result is null or putt_distance_result in ('short', 'long')
  ),
  add column putt_direction_result text check (
    putt_direction_result is null or putt_direction_result in ('left', 'right')
  );

-- Backfill from legacy putt_result.
update public.shots
set
  putt_distance_result = case
    when putt_result = 'short' then 'short'
    when putt_result = 'long' then 'long'
    else null
  end,
  putt_direction_result = case
    when putt_result = 'missed_left' then 'left'
    when putt_result = 'missed_right' then 'right'
    else null
  end
where putt_result is not null;
