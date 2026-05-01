-- Per-source crawl progress tracking. Used by scripts/crawl-courses.ts to
-- make crawls resumable: each row id is `<source>:<scope>` (e.g.
-- 'opengolfapi:state:TX') and tracks last run time, items processed, and
-- status. Service role only — no public access.
create table public.crawl_state (
  id text primary key,
  last_crawled_at timestamptz,
  items_processed integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'done', 'error')),
  error_message text,
  updated_at timestamptz not null default now()
);

alter table public.crawl_state enable row level security;
-- No policies: only the crawler script (service role) writes.
