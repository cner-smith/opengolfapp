-- #1400: why a height grid is flagged, e.g. 'lidar predates the green', to match
-- outline_flag_reason. Only a flagged grid carries a reason.
alter table public.green_maps
  add column grid_flag_reason text,
  add constraint green_maps_grid_flag_reason_check check (grid_flagged or grid_flag_reason is null);
