-- OGA initial schema
-- Tables: profiles, courses, holes, rounds, hole_scores, shots, drills, practice_plans
-- All user-owned tables have RLS enabled with policies that scope rows to auth.uid().

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  handicap_index numeric(4, 1),
  skill_level text check (skill_level in ('beginner', 'casual', 'developing', 'competitive')),
  goal text check (goal in ('break_100', 'break_90', 'break_80', 'break_70s', 'scratch')),
  play_frequency text,
  facilities text[] default '{}',
  play_style text check (play_style in ('casual', 'mixed', 'competitive')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  location text,
  mapbox_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- holes
-- ---------------------------------------------------------------------------
create table public.holes (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid not null references public.courses(id) on delete cascade,
  number int not null check (number between 1 and 18),
  par int not null check (par between 3 and 6),
  yards int,
  stroke_index int check (stroke_index between 1 and 18),
  tee_lat numeric,
  tee_lng numeric,
  pin_lat numeric,
  pin_lng numeric,
  unique (course_id, number)
);

-- ---------------------------------------------------------------------------
-- rounds
-- ---------------------------------------------------------------------------
create table public.rounds (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id),
  played_at date not null,
  tee_color text,
  total_score int,
  total_putts int,
  fairways_hit int,
  fairways_total int,
  gir int,
  sg_off_tee numeric(5, 2),
  sg_approach numeric(5, 2),
  sg_around_green numeric(5, 2),
  sg_putting numeric(5, 2),
  sg_total numeric(5, 2),
  notes text,
  created_at timestamptz not null default now()
);

create index rounds_user_id_played_at_idx on public.rounds (user_id, played_at desc);

-- ---------------------------------------------------------------------------
-- hole_scores
-- ---------------------------------------------------------------------------
create table public.hole_scores (
  id uuid primary key default uuid_generate_v4(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  hole_id uuid not null references public.holes(id),
  score int not null,
  putts int,
  fairway_hit boolean,
  gir boolean,
  sg_off_tee numeric(4, 2),
  sg_approach numeric(4, 2),
  sg_around_green numeric(4, 2),
  sg_putting numeric(4, 2),
  unique (round_id, hole_id)
);

create index hole_scores_round_id_idx on public.hole_scores (round_id);

-- ---------------------------------------------------------------------------
-- shots
-- ---------------------------------------------------------------------------
create table public.shots (
  id uuid primary key default uuid_generate_v4(),
  hole_score_id uuid not null references public.hole_scores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  shot_number int not null,
  start_lat numeric,
  start_lng numeric,
  end_lat numeric,
  end_lng numeric,
  aim_lat numeric,
  aim_lng numeric,
  distance_to_target int,
  club text,
  lie_type text check (
    lie_type in ('tee', 'fairway', 'rough', 'sand', 'fringe', 'recovery', 'green')
  ),
  lie_slope text check (
    lie_slope in ('level', 'uphill', 'downhill', 'ball_above', 'ball_below')
  ),
  shot_result text,
  penalty boolean not null default false,
  ob boolean not null default false,
  aim_offset_yards numeric(4, 1),
  break_direction text check (break_direction in ('left', 'right', 'straight')),
  putt_result text check (
    putt_result in ('made', 'short', 'long', 'missed_left', 'missed_right')
  ),
  putt_distance_ft numeric(4, 1),
  notes text,
  created_at timestamptz not null default now(),
  unique (hole_score_id, shot_number)
);

create index shots_user_id_idx on public.shots (user_id);
create index shots_hole_score_id_idx on public.shots (hole_score_id);
create index shots_club_user_idx on public.shots (user_id, club);

-- ---------------------------------------------------------------------------
-- drills (global library)
-- ---------------------------------------------------------------------------
create table public.drills (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  duration_min int,
  category text check (category in ('off_tee', 'approach', 'around_green', 'putting')),
  facility text[] default '{}',
  skill_levels text[] default '{}',
  instructions text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- practice_plans
-- ---------------------------------------------------------------------------
create table public.practice_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  generated_at timestamptz not null default now(),
  valid_until date,
  based_on_rounds int,
  focus_areas jsonb,
  drills jsonb,
  ai_insight text,
  completed_drill_ids text[] not null default '{}'
);

create index practice_plans_user_idx on public.practice_plans (user_id, generated_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.holes enable row level security;
alter table public.rounds enable row level security;
alter table public.hole_scores enable row level security;
alter table public.shots enable row level security;
alter table public.drills enable row level security;
alter table public.practice_plans enable row level security;

-- profiles
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- courses (publicly readable; any authenticated user can add)
create policy "Anyone can read courses"
  on public.courses for select
  using (true);

create policy "Authenticated users can add courses"
  on public.courses for insert
  with check (auth.uid() is not null);

-- holes (publicly readable; only course creator can write)
create policy "Anyone can read holes"
  on public.holes for select
  using (true);

create policy "Course creators can insert holes"
  on public.holes for insert
  with check (
    exists (
      select 1 from public.courses c
      where c.id = course_id and (c.created_by = auth.uid() or c.created_by is null)
    )
  );

-- rounds
create policy "Users can CRUD own rounds"
  on public.rounds for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- hole_scores (scoped through rounds.user_id)
create policy "Users can CRUD own hole scores"
  on public.hole_scores for all
  using (
    exists (
      select 1 from public.rounds r
      where r.id = round_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.rounds r
      where r.id = round_id and r.user_id = auth.uid()
    )
  );

-- shots
create policy "Users can CRUD own shots"
  on public.shots for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- drills (publicly readable)
create policy "Anyone can read drills"
  on public.drills for select
  using (true);

-- practice_plans
create policy "Users can CRUD own plans"
  on public.practice_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
