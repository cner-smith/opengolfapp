-- OGA seed data
-- Drills: 24 covering all categories and skill brackets.
-- Courses: 3 made-up demo courses + 18 holes each (par-72).
-- Run via: npx supabase db reset (resets local DB and applies migrations + seed).

-- ---------------------------------------------------------------------------
-- Drills
-- ---------------------------------------------------------------------------
insert into public.drills (name, description, duration_min, category, facility, skill_levels, instructions) values
-- off_tee
('Tee shot fairway finder',
 'Hit driver to a defined fairway corridor.',
 20, 'off_tee', '{range}', '{beginner,casual,developing,competitive}',
 'Imagine a 30-yard-wide fairway. Hit 10 drivers tracking which finish in, left, or right. Goal: 6/10 in.'),

('Driver shape ladder',
 'Alternate intentional draw and fade with driver.',
 20, 'off_tee', '{range}', '{developing,competitive}',
 'Hit 10 driver pairs: one draw, one fade. Track which finish on the intended side of center.'),

('3-tee tempo drill',
 'Build rhythm by hitting drivers at 50%, 75%, 100% effort.',
 15, 'off_tee', '{range}', '{beginner,casual,developing}',
 'Hit 5 balls at each effort level. Note how distance and dispersion change.'),

('3-wood off the deck',
 'Build a reliable second long-club option.',
 15, 'off_tee', '{range}', '{developing,competitive}',
 'Hit 10 fairway shots with 3-wood off the deck. Goal: 7/10 solid contact.'),

-- approach
('9-shot grid',
 'Hit 9 shots to a target, varying shape and trajectory in a 3x3 grid.',
 15, 'approach', '{range}', '{developing,competitive}',
 'Pick a target 150 yards away. Hit 3 draws, 3 straight, 3 fades. Track where each lands relative to your aim.'),

('Gate drill',
 'Place two alignment sticks 1 yard apart at target distance as a gate to hit through.',
 20, 'approach', '{range}', '{developing,competitive}',
 'Set sticks 1 yard apart at 150 yards. Land the ball between them. Track success rate over 20 shots.'),

('Random distance approach',
 'Switch clubs every shot to simulate on-course decision making.',
 25, 'approach', '{range}', '{casual,developing,competitive}',
 'Pick 10 random yardages between 80–180. Hit one shot to each. Track proximity to target.'),

('Wedge ladder',
 'Three-quarter, half, and full wedges to escalating distances.',
 20, 'approach', '{range}', '{beginner,casual,developing,competitive}',
 'Hit 5 each at 50, 75, 100 yards. Compare carry distance vs. desired.'),

('Fairway divot drill',
 'Train ball-first contact with iron approaches.',
 15, 'approach', '{range}', '{beginner,casual,developing}',
 'Place a tee 1 inch in front of the ball. Hit the ball, then take the tee. Repeat 20 times.'),

-- around_green
('Up-and-down challenge',
 'Score chips and bunker shots with a putt-out finish.',
 20, 'around_green', '{short_game}', '{casual,developing,competitive}',
 'Drop 10 balls around the green. Chip, then putt. Score = number of up-and-downs.'),

('Bump-and-run grid',
 'Practice low rolling shots to multiple flags.',
 20, 'around_green', '{short_game}', '{beginner,casual,developing,competitive}',
 'Choose 3 pins. Hit 5 bump-and-runs to each. Count balls finishing inside 6 feet.'),

('Sand-shot 10s',
 'Reps from greenside bunker.',
 20, 'around_green', '{short_game}', '{casual,developing,competitive}',
 'Hit 10 sand shots from a greenside bunker to a flag 25 feet away. Goal: 5/10 inside 8 feet.'),

('Lob over a barrier',
 'High soft shots over an obstacle.',
 15, 'around_green', '{short_game}', '{developing,competitive}',
 'Place a bag/towel between you and a flag. Lob 10 wedges over it. Goal: 6/10 finish past the bag and inside 10 feet.'),

('Three-club chip',
 'Chip the same shot with PW, 9i, and 7i.',
 15, 'around_green', '{short_game}', '{beginner,casual,developing}',
 'From 20 feet off the green, chip 5 with each club. Pick the most consistent.'),

-- putting
('3-6-9 putting ladder',
 'Progressive putting drill from 3, 6, and 9 feet.',
 15, 'putting', '{putting}', '{beginner,casual,developing,competitive}',
 'Place 3 balls each at 3, 6, 9 ft. Make all 3 at a distance to advance. Restart from 3ft on a miss.'),

('Lag putting clock',
 'Long putts from 4 directions.',
 15, 'putting', '{putting}', '{beginner,casual,developing,competitive}',
 'From 30, 40, 50 feet at N, S, E, W of a hole hit 1 ball each. Goal: lag inside 3 feet.'),

('Gate putting',
 'Roll putts through two tees just wider than the ball.',
 15, 'putting', '{putting}', '{developing,competitive}',
 'Set two tees 1.5 inches apart, 6 inches in front of the ball. Roll 20 putts through the gate.'),

('Read-and-roll',
 'Read the line, commit, and pull the trigger.',
 20, 'putting', '{putting}', '{casual,developing,competitive}',
 'Hit 10 breaking putts from 8 feet with no practice strokes. Track makes.'),

('One-handed putting',
 'Trail-hand-only putts to feel face control.',
 10, 'putting', '{putting,anywhere}', '{developing,competitive}',
 'Hit 20 putts from 5 feet with the trail hand only. Track makes.'),

('Tee gauntlet',
 'Set tees as gates at 3, 6, 9, 12 feet on a straight putt.',
 20, 'putting', '{putting}', '{beginner,casual,developing,competitive}',
 'Roll putts through each gate in sequence. Reset after a miss.'),

-- mixed / anywhere
('Pre-shot routine reps',
 'Lock in your routine off the course.',
 10, 'approach', '{anywhere}', '{beginner,casual,developing,competitive}',
 'Run 10 pre-shot routines without hitting a ball. Time each one. Aim for under 25 seconds.'),

('Indoor mirror swing',
 'Slow swings in front of a mirror.',
 10, 'approach', '{anywhere}', '{beginner,casual,developing}',
 'Make 25 slow swings checking posture, takeaway, and finish. No ball required.'),

('Yardage book reading',
 'Course-management training off the course.',
 15, 'off_tee', '{anywhere}', '{developing,competitive}',
 'Pick 5 holes from a course you play. Plan 3 alternate strategies for each based on wind/lie.'),

('Sim launch session',
 'Calibrate carry yardages on a launch monitor.',
 30, 'approach', '{sim}', '{casual,developing,competitive}',
 'Hit 10 shots with each iron. Record median carry. Update your yardage chart.');

-- ---------------------------------------------------------------------------
-- Demo courses + holes (par-72 each)
-- ---------------------------------------------------------------------------
do $$
declare
  c1 uuid := gen_random_uuid();
  c2 uuid := gen_random_uuid();
  c3 uuid := gen_random_uuid();
begin
  insert into public.courses (id, name, location) values
    (c1, 'Pine Ridge Golf Club', 'Demo, USA'),
    (c2, 'Lakeside National', 'Demo, USA'),
    (c3, 'Old Mill Links', 'Demo, USA');

  insert into public.holes (course_id, number, par, yards, stroke_index)
  select c1, n,
         case when n in (3, 7, 12, 17) then 3
              when n in (5, 14) then 5
              else 4 end,
         case when n in (3, 7, 12, 17) then 165
              when n in (5, 14) then 540
              else 410 end,
         n
  from generate_series(1, 18) as n;

  insert into public.holes (course_id, number, par, yards, stroke_index)
  select c2, n,
         case when n in (4, 8, 11, 16) then 3
              when n in (2, 13) then 5
              else 4 end,
         case when n in (4, 8, 11, 16) then 175
              when n in (2, 13) then 555
              else 425 end,
         n
  from generate_series(1, 18) as n;

  insert into public.holes (course_id, number, par, yards, stroke_index)
  select c3, n,
         case when n in (2, 9, 13, 17) then 3
              when n in (6, 15) then 5
              else 4 end,
         case when n in (2, 9, 13, 17) then 155
              when n in (6, 15) then 525
              else 395 end,
         n
  from generate_series(1, 18) as n;
end $$;
