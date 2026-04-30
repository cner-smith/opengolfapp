-- Per-user distance unit preference. Yards is the default for
-- compatibility with existing US-centric stats; metres flips display
-- formatting in the apps. Storage stays in yards/feet across the schema —
-- this column only changes how distances render.
alter table public.profiles
  add column distance_unit text not null default 'yards'
  check (distance_unit in ('yards', 'meters'));
