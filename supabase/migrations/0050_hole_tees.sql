-- Per-tee override for a hole's yardage/par/stroke_index/tee-box location.
-- Sparse by design: a hole with no matching row here just falls back to the
-- base `holes` values (holes.par/yards/stroke_index/tee_lat/tee_lng). Pin
-- location is deliberately NOT here — the green doesn't move per tee, only
-- the tee box does.
create table public.hole_tees (
  id uuid primary key default gen_random_uuid(),
  hole_id uuid not null references public.holes(id) on delete cascade,
  course_tee_id uuid not null references public.course_tees(id) on delete cascade,
  yards integer,
  par integer check (par is null or par between 3 and 6),
  stroke_index integer check (stroke_index is null or stroke_index between 1 and 18),
  tee_lat double precision,
  tee_lng double precision,
  unique (hole_id, course_tee_id)
);

alter table public.hole_tees enable row level security;

-- Public read (round scoring/maps need this for every user), no write
-- policy — only the service-role dev-editor backend can write until a
-- real user-facing editing path exists. Deleting a course_tees row
-- cascades into hole_tees, which is correct/desired, not an oversight.
create policy hole_tees_read on public.hole_tees for select using (true);

create index idx_hole_tees_hole_id on public.hole_tees(hole_id);
create index idx_hole_tees_course_tee_id on public.hole_tees(course_tee_id);
