-- How many holes a round plays, chosen when it's created (#727). An unmapped
-- course (no holes rows, no course_tees row) can't tell its count, and a
-- course's holes rows accrete one save at a time, so neither is a reliable
-- signal mid-round. Courses come in 3, 6, 9, 12 and 18 holes, so any count
-- from 1 to 18 (holes.number stops at 18, 0001). Null on rounds created
-- before this column: those keep the old guess (course_tees.par <= 36 = 9,
-- else 18). No backfill.
alter table public.rounds
  add column hole_count smallint check (hole_count between 1 and 18);
