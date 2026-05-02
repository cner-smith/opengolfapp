-- shots.shot_result was free text. Constrain to the SHOT_RESULTS list
-- in @oga/core/constants so a typo'd insert can't reach storage and
-- silently break stats bucketing (RESULT_QUALITY in types.ts maps off
-- this exact set).
--
-- Keep the value list in sync with SHOT_RESULTS in
-- packages/core/src/constants.ts.

alter table public.shots
  add constraint shot_result_values
  check (
    shot_result is null
    or shot_result in (
      'solid',
      'push_right',
      'pull_left',
      'fat',
      'thin',
      'shank',
      'topped',
      'penalty',
      'ob'
    )
  );
