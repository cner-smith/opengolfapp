-- Per-hole penalty-stroke count, entered in the end-of-hole summary
-- ("how'd it go?" — score / putts / penalties tickers). Additive and
-- defaulted to 0, so existing rows, the scorecard, and all SG/score math
-- are unaffected until a user actually records a penalty.
alter table public.hole_scores
  add column if not exists penalties integer not null default 0;
