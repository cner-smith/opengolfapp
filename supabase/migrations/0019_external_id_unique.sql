-- Partial unique index on courses.external_id so the OpenGolfAPI
-- crawler can't insert duplicate course rows for the same upstream id.
-- NULL is left unconstrained because manual user-created courses don't
-- have an external_id and we don't want them to collide on a synthetic
-- empty key.
--
-- 0004 added a non-unique idx_courses_external_id; we keep that index
-- in place — it still services lookup-by-external_id queries — and add
-- a separate partial UNIQUE on top.

create unique index if not exists courses_external_id_unique
  on public.courses(external_id)
  where external_id is not null;
