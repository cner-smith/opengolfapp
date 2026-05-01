-- Course geolocation: lat/lng for map display + nearest-course search,
-- and city/state as discrete columns so the crawler doesn't have to round-
-- trip through the freeform `location` string. The legacy `location`
-- column stays for back-compat — crawler keeps it populated as
-- "city, state" so existing UI keeps working.
alter table public.courses
  add column lat numeric,
  add column lng numeric,
  add column city text,
  add column state text;

-- Best-effort backfill from the legacy `location` text. Rows that don't
-- match the "City, ST" pattern keep null city/state — the crawler will
-- fill them in on next run.
update public.courses
set
  city = trim(split_part(location, ',', 1)),
  state = trim(split_part(location, ',', 2))
where location is not null
  and location like '%,%';
