-- Per-round pin position. Pins move daily; holes.pin_lat/pin_lng is the
-- course default, but each round captures the actual flag location during
-- live play. Falls back to holes.pin_lat/pin_lng when null.
alter table public.hole_scores
  add column pin_lat numeric,
  add column pin_lng numeric;
