-- profiles.play_frequency was free text while every other onboarding
-- field (skill_level, goal, play_style) had a CHECK constraint. The
-- onboarding form only writes one of four values; pin the schema to
-- match so a typo'd insert fails fast.
--
-- Values come from FREQUENCIES in
-- apps/web/src/pages/onboarding/steps/Step4Details.tsx — keep this
-- list in sync if a new option is added there.

alter table public.profiles
  add constraint play_frequency_values
  check (
    play_frequency is null
    or play_frequency in ('monthly', 'weekly', 'multi_weekly', 'daily')
  );
