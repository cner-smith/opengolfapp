-- putt_distance_ft and aim_offset_yards were numeric(4,1), so 1000 or more
-- failed the whole insert with 22003 numeric field overflow (#994, #1037).
-- Several writers can produce that: a long "putt" marked on the past-round
-- map, typed lengths, imports (#1041). Widening removes the failure for all of
-- them. Raising precision at the same scale keeps every stored value as is.
alter table public.shots
  alter column putt_distance_ft type numeric(6, 1),
  alter column aim_offset_yards type numeric(6, 1);
