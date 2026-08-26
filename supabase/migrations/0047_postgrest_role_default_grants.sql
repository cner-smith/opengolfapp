-- `supabase db reset` applies these migrations as the `postgres` role, so
-- every table here is owned by `postgres`. The Supabase local image's own
-- bootstrap sets default privileges so future tables owned by
-- `supabase_admin` auto-grant full CRUD to anon/authenticated/service_role,
-- but nothing in this repo's migration history ever did the same for the
-- `postgres` role — so on a from-scratch reset, PostgREST (which runs
-- queries as anon/authenticated/service_role) gets "permission denied" on
-- the first table it touches. RLS policies are the real access boundary
-- throughout this schema; these grants are just the base plumbing PostgREST
-- needs to attempt a query at all.
--
-- Two parts: backfill grants on tables this migration history already
-- created, and set default privileges so tables created by later
-- migrations get them automatically.
--
-- `anon` only gets `select` (defense-in-depth beyond RLS: a table that ships
-- with RLS disabled, or created before its own `enable row level security`
-- runs, stays anon-readable but not anon-writable). `authenticated` and
-- `service_role` keep full DML since RLS is expected to scope their writes.
grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant select on tables to anon;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
