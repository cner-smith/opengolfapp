-- Drop the redundant courses.location column. 0011 added discrete `city`
-- and `state` columns and the crawler has been keeping `location` populated
-- as "city, state" only for back-compat. Now that every read site can
-- derive the same string from city + state, the legacy column has no
-- callers and just doubles the write cost.
alter table public.courses drop column if exists location;
