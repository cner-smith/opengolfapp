-- Split lie_slope into two independent axes. A lie can have a forward
-- component (uphill/level/downhill) AND a side component (ball above /
-- ball below feet) at the same time — the original single field could
-- only capture one. The legacy `lie_slope` column is kept around so
-- pre-migration rows still read; new writes target the split columns.
alter table public.shots
  add column lie_slope_forward text check (
    lie_slope_forward in ('uphill', 'level', 'downhill')
  ),
  add column lie_slope_side text check (
    lie_slope_side in ('ball_above', 'ball_below')
  );

-- Backfill existing rows. Forward slope falls back to 'level' when the
-- legacy value was a side-only ('ball_above'/'ball_below') so that the
-- new "level + ball above" combo is preserved.
update public.shots
set
  lie_slope_forward = case
    when lie_slope = 'uphill' then 'uphill'
    when lie_slope = 'downhill' then 'downhill'
    else 'level'
  end,
  lie_slope_side = case
    when lie_slope = 'ball_above' then 'ball_above'
    when lie_slope = 'ball_below' then 'ball_below'
    else null
  end
where lie_slope is not null;
