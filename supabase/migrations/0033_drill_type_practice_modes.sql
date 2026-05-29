-- 0033: drill_type becomes the practice MODE (taxonomy redesign).
--
-- Retire 'technical' (it collapsed the article's blocked<->random distinction),
-- add 'on_course', and drop the unused 'putting' type (putting is a category, not
-- a mode). New vocabulary: warmup · blocked · random · skill_game · pressure_game
-- · on_course. Existing rows are re-tagged to match seed.sql; AimPoint Express
-- Green Reading is removed (a taught green-reading method, not a drill).
--
-- Owner rule applied: a recorded score you replay to beat = skill_game.
-- Plan: docs/internal/practice-mode-taxonomy-plan.md

-- 1. Drop the existing drill_type CHECK (auto-named in 0030) so rows can be re-tagged.
do $$
declare cn text;
begin
  select conname into cn
    from pg_constraint
   where conrelid = 'public.drills'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%drill_type%';
  if cn is not null then
    execute format('alter table public.drills drop constraint %I', cn);
  end if;
end $$;

-- 2. Remove AimPoint Express Green Reading — a taught method, not a drill.
delete from public.drills where name = 'AimPoint Express Green Reading';

-- 3. The four score-to-beat ex-technical drills become skill_game.
update public.drills set drill_type = 'skill_game'
 where name in (
   'Tipping-Point Speed Test',
   'Towel Landing-Zone Pitch',
   'Tee-Corridor Lag (Never Short)',
   'Eyes-Closed Speed Calibration'
 );

-- 4. Every remaining 'technical' drill is blocked (same-shot repetition).
update public.drills set drill_type = 'blocked' where drill_type = 'technical';

-- 5. New default + CHECK over the mode vocabulary. ('random' and 'on_course' have
--    no drills yet — they are filled in a follow-up.)
alter table public.drills alter column drill_type set default 'blocked';
alter table public.drills
  add constraint drills_drill_type_check
  check (drill_type in ('warmup','blocked','random','skill_game','pressure_game','on_course'));
