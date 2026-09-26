-- #951: split the shot result into three independent, optional axes, the
-- way 0006 split the putt result. shot_result stays, populated by the core
-- mapper (legacyShotResult) so stats / SG / patterns keep reading it.
-- Penalty and OB stay the shots.penalty / shots.ob flags.
--
-- Keep the value lists in sync with SHOT_CONTACTS / SHOT_SHAPES /
-- SHOT_START_LINES in packages/core/src/constants.ts.

alter table public.shots
  add column contact text,
  add column shape text,
  add column start_line text;

alter table public.shots
  add constraint shot_contact_values
    check (contact is null or contact in ('solid', 'fat', 'thin', 'topped', 'shank')),
  add constraint shot_shape_values
    check (shape is null or shape in ('hook', 'draw', 'straight', 'fade', 'slice')),
  add constraint shot_start_line_values
    check (start_line is null or start_line in ('pull', 'on_line', 'push'));

-- Backfill from the legacy value. Shape has no legacy source.
update public.shots
set
  contact = case when shot_result in ('solid', 'fat', 'thin', 'topped', 'shank') then shot_result end,
  start_line = case shot_result when 'pull_left' then 'pull' when 'push_right' then 'push' end
where shot_result in ('solid', 'fat', 'thin', 'topped', 'shank', 'pull_left', 'push_right');
