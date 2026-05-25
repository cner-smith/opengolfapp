-- Break direction splits into two independent axes — vertical
-- (uphill/downhill/flat) and horizontal (L→R / R→L / straight). Either
-- or both can be null. Legacy single-value break_direction is preserved
-- on the existing column so existing reads keep working until consumers
-- migrate. Same shape as migrations 0003 (lie_slope split) and 0006
-- (putt_result split). See issue #340.
alter table public.shots
  add column break_direction_vertical text check (
    break_direction_vertical is null
    or break_direction_vertical in ('uphill', 'downhill', 'flat')
  ),
  add column break_direction_horizontal text check (
    break_direction_horizontal is null
    or break_direction_horizontal in ('left_to_right', 'right_to_left', 'straight')
  );

-- Backfill from legacy break_direction. Legacy single-letter `left` /
-- `right` map onto the new break-from→to vocabulary the same way
-- mapBreakDirection() in @oga/core/round.ts already handles them
-- (left = breaks right-to-left, right = breaks left-to-right).
update public.shots
set
  break_direction_vertical = case
    when break_direction = 'uphill' then 'uphill'
    when break_direction = 'downhill' then 'downhill'
    else null
  end,
  break_direction_horizontal = case
    when break_direction = 'left_to_right' then 'left_to_right'
    when break_direction = 'right_to_left' then 'right_to_left'
    when break_direction = 'straight' then 'straight'
    when break_direction = 'left' then 'right_to_left'
    when break_direction = 'right' then 'left_to_right'
    else null
  end
where break_direction is not null;
