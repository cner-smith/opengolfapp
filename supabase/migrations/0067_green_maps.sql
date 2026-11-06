-- #1373: a green's outline and height grid, one row per hole. A separate table, not
-- holes columns, because both apps select('*') from holes per course and the grid
-- would ride along on every hole read. No PostGIS: the pin and "on the green" checks
-- run on the client, which holds the ring, and geometry + GiST would cost ~55% more
-- space for queries nothing runs (storage research, #1372).
-- A hole with loop_of (0066) reads its front-nine hole's row; it gets none of its own.
create table public.green_maps (
  hole_id uuid primary key references public.holes(id) on delete cascade,

  -- Google encoded polyline, precision 6, a closed lng/lat ring.
  outline text not null,
  area_m2 real not null check (area_m2 > 0),
  outline_source text not null check (outline_source in ('osm', 'model', 'manual')),
  -- The model's confidence; null for OSM and manual outlines.
  outline_score real,
  -- Set by a check the importers can't run (e.g. the offline NAIP "trace looks
  -- wrong" pass, or an OSM green matched only by distance).
  outline_flagged boolean not null default false,
  outline_flag_reason text,

  -- Height grid, codec v1 (version, step_mm, W, H, zmin_mm, Rice k, run-length mask,
  -- Rice-coded planar-predictor residuals). 0.5 m cells, row 0 = north, col 0 = west.
  -- The blob carries no position: grid_lng0/grid_lat0 = the centre of cell (0,0).
  grid bytea check (octet_length(grid) <= 16384),
  grid_lng0 double precision,
  grid_lat0 double precision,
  -- The lidar project, e.g. '3dep:OK_Panhandle_B1B_2018'.
  grid_source text,
  -- Null when the survey only gives a year.
  grid_flown_on date,
  -- e.g. the flight predates the green's construction or renovation (#1377).
  grid_flagged boolean not null default false,

  updated_at timestamptz not null default now(),

  check (outline_flagged or outline_flag_reason is null),
  check ((grid is null) = (grid_lng0 is null)
     and (grid is null) = (grid_lat0 is null)
     and (grid is null) = (grid_source is null))
);

alter table public.green_maps enable row level security;

-- Public read like holes; no write policy, so only the service-role importers and
-- the lidar pipeline write.
create policy green_maps_read on public.green_maps for select using (true);

create trigger green_maps_updated_at
  before update on public.green_maps
  for each row execute function public.update_updated_at();
