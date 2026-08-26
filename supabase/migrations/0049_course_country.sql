-- Courses outside the US (e.g. Merchants of Edinburgh) have no meaningful
-- `state`, and address/website alone don't disambiguate country. Nullable,
-- dev-entered via the Course Editor same as website/address.
alter table public.courses
  add column country text;

alter table public.facilities
  add column country text;
