-- 0022_user_clubs.sql
-- Per-user club bag. Replaces the static @oga/core CLUBS list as the
-- source of truth for what shows up in the shot logger and what
-- inferShot() can suggest. Each row is one club a user owns.
--
-- Closes #11.

CREATE TABLE public.user_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  club_type text NOT NULL,
  loft numeric,
  typical_distance_yards numeric,
  sort_order integer NOT NULL DEFAULT 0,
  in_bag boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_clubs_user_club_unique UNIQUE (user_id, club_type)
);

ALTER TABLE public.user_clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own clubs"
  ON public.user_clubs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX user_clubs_in_bag_idx
  ON public.user_clubs (user_id, sort_order)
  WHERE in_bag = true;
