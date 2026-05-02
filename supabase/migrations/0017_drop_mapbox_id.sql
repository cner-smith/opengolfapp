-- Drop unused courses.mapbox_id column. The Mapbox course-search integration
-- never shipped — courses are linked via external_id (OpenGolfAPI / OSM)
-- instead. Column has been NULL on every row in production.

alter table public.courses
  drop column if exists mapbox_id;
