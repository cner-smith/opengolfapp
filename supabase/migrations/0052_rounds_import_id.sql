-- Provider-agnostic external-import reference for rounds, mirroring the
-- courses.external_id pattern (0004/0019). Format "<provider>:<id>", e.g.
-- "garmin:98765432". Lets the "Import from data" feature detect/block
-- re-importing a round it's already brought in without being tied to any
-- one provider.
alter table public.rounds add column import_id text;

-- Scoped to (user_id, import_id), not import_id alone: nothing guarantees
-- a provider's id is unique *across* accounts (and a source with no
-- stable ids at all might reuse a caller-chosen string like "manual:1"),
-- so a global unique index would let one user's import block another
-- user's.
create unique index if not exists rounds_import_id_unique
  on public.rounds(user_id, import_id)
  where import_id is not null;
