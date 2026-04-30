-- External ID for cross-referencing courses imported from third-party
-- providers (OpenGolfAPI today; OSM way ids could land here too). Used
-- to dedupe imports without relying on fuzzy name matching.
alter table public.courses add column external_id text;
create index if not exists idx_courses_external_id on public.courses(external_id);
