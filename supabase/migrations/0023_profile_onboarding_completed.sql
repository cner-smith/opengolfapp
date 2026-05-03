-- 0023_profile_onboarding_completed.sql
-- Explicit completion flag so the post-onboarding redirect doesn't race
-- against cached "fields might be null" reads. Existing users with
-- skill_level + goal already filled in are backfilled to true so they
-- aren't bounced back through onboarding when they next sign in.

ALTER TABLE public.profiles
  ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;

UPDATE public.profiles
  SET onboarding_completed = true
  WHERE skill_level IS NOT NULL
    AND goal IS NOT NULL;
