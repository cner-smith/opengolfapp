-- 0031_practice_plan_cadence_unique.sql
-- One generated plan per user per UTC day: blocks the double-tap / replay race.
-- (Weekly cadence is still enforced in-app by the valid_until guard; this index
--  is the concurrency backstop, not the cadence policy. No-regen-within-window
--  means a legit user never wants a 2nd plan same-day anyway.)
--
-- generated_at is timestamptz, so date_trunc('day', col) is only STABLE (depends
-- on session TimeZone). Converting to UTC first yields a plain timestamp and
-- date_trunc(text, timestamp) IS immutable — Postgres will accept the expression.

create unique index if not exists practice_plans_user_day_uniq
  on public.practice_plans (user_id, (date_trunc('day', (generated_at at time zone 'UTC'))));
