-- Putting-specific shot context. Mobile putting sheet captures slope
-- intensity (0=flat, 4=severe) and green speed (slow/medium/fast) so
-- shot patterns and green logging stats can correlate misses with
-- conditions.
alter table public.shots
  add column putt_slope_pct integer check (putt_slope_pct is null or putt_slope_pct between 0 and 4),
  add column green_speed text check (green_speed is null or green_speed in ('slow', 'medium', 'fast'));
