-- Which way the player swings. Shot shape and start line are named for the
-- swing (a lefty's draw curves left-to-right), so the result pickers mirror
-- their keys from this on web and mobile. Separate from mobile's
-- "live round layout" (which hand holds the phone, device-local).
alter table public.profiles
  add column if not exists plays_left_handed boolean not null default false;
