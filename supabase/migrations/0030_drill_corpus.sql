-- 0030_drill_corpus.sql
-- AI practice plan (#18), corpus track. Enriches `drills` so retrieval can gate
-- (goals/targets/drill_type), targets can scale (target_template, engine track),
-- and provenance + contributions are tracked (source/contributor/verified).
-- Bundles the practice_plans columns the generator reads/writes.
-- Schema only — drill rows are authored in seed.sql (corpus track).

alter table public.drills
  add column if not exists goals           text[]  not null default '{}',   -- goal bands a drill suits (break_100 .. scratch)
  add column if not exists targets         text[]  not null default '{}',   -- weakness tags (start_line, dispersion, lag, ...)
  add column if not exists drill_type      text    not null default 'technical'
    check (drill_type in ('warmup','technical','skill_game','pressure_game','putting')),
  add column if not exists target_template jsonb,                           -- measurement + skill scaling; resolved in @oga/core (engine track)
  add column if not exists source          text,                           -- instructional origin (PGA pro / book / video / study)
  add column if not exists source_url      text
    check (source_url is null or source_url ~ '^https?://'),               -- link to origin (nullable; http(s) only — blocks javascript: etc. at the boundary)
  add column if not exists contributor     text,                           -- who added the drill to OGA (GH handle/name)
  add column if not exists verified        boolean not null default false; -- maintainer-vetted; retrieval gate requires true

create index if not exists drills_targets_gin on public.drills using gin (targets);
create index if not exists drills_goals_gin   on public.drills using gin (goals);

-- Feedback loop + generator output (read on the next generation, so bundled here).
alter table public.practice_plans
  -- One UNTRUSTED free-text note per plan (next-gen loop). DB-capped here so a
  -- direct client write can't exceed it; MUST also be delimited/sanitized
  -- before any prompt interpolation — preference-signal only, never able to
  -- override rules/schema/drill set (spec D14). Treat as injection-prone input.
  add column if not exists feedback         text check (char_length(feedback) <= 500),
  add column if not exists coach_note       text,   -- editorial "why this week" (OGA voice)
  add column if not exists raw_model_output jsonb;  -- persisted tool-call output for spot-check / regression
