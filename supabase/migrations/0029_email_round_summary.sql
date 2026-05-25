-- 0029_email_round_summary.sql
-- Email scaffold (#317): round completion timestamp, summary-send tracking,
-- and the per-user opt-in flag.

alter table public.rounds
  add column if not exists completed_at timestamptz,
  add column if not exists summary_email_sent_at timestamptz;

alter table public.profiles
  add column if not exists email_round_summaries_enabled boolean not null default true;

-- Supports the cron's pending-email scan: completed rounds not yet emailed.
create index if not exists rounds_pending_summary_email_idx
  on public.rounds (completed_at)
  where summary_email_sent_at is null;
