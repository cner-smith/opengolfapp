-- Dev-only Course Editor needs somewhere to store address/website. Nullable,
-- no format validation — developer-entered data, not user-facing input.
alter table public.courses
  add column website text,
  add column address text;

alter table public.facilities
  add column website text,
  add column address text;
