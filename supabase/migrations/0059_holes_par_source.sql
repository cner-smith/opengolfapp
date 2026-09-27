-- Where a hole's par came from. The OSM crawler defaulted a missing par tag
-- to 4, so ~870 prod courses read all-par-4 (#912); those pars are now
-- inferred from length and marked 'inferred' so they can be told apart from
-- real ones (OSM tag / OpenGolfAPI / a player's correction). NULL = written
-- before this column existed.
alter table public.holes
  add column if not exists par_source text
    check (par_source in ('osm', 'api', 'inferred', 'user'));
