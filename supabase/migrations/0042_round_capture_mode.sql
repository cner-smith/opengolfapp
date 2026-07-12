-- Per-round capture mode for the live-round flow (#791 step 3).
-- 'track_patterns' captures an explicit aim per shot for the dispersion
-- dataset; 'just_track' records ball locations only (score + GPS distances),
-- no aim prompt. Default 'track_patterns' preserves the behavior every round
-- created before the picker shipped.
alter table public.rounds
  add column capture_mode text not null default 'track_patterns'
  check (capture_mode in ('just_track', 'track_patterns'));
