-- Fix this green (#1504/#1505): a player's own outline for a green, drawn over
-- the satellite map. Private for now (owner 2026-11-24): each player reads and
-- writes only their own; sharing between players comes later, tuned on these
-- drawings. One current outline per player per green; a redraw replaces it.
-- hole_id is the green_maps hole (a loop hole's front-nine hole).

create table public.player_green_outlines (
  hole_id uuid not null references public.holes(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Encoded polyline, as green_maps.outline. A green is a few dozen points.
  outline text not null check (length(outline) between 6 and 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (hole_id, user_id)
);

alter table public.player_green_outlines enable row level security;

create policy player_green_outlines_own on public.player_green_outlines
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create trigger player_green_outlines_updated_at
  before update on public.player_green_outlines
  for each row execute function public.update_updated_at();
