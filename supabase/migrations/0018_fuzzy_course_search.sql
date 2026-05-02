-- Fuzzy course search backed by the pg_trgm GIN index added in 0015.
-- ILIKE alone misses obvious typos ("Pebbel Beach" -> "Pebble Beach")
-- and fails on word-order variants. The function ORs trigram similarity
-- with ILIKE so substring matches still surface, then orders by
-- similarity score so the closest match floats to the top.

create or replace function public.search_courses(
  search_query text,
  result_limit int default 10
)
returns setof public.courses
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.courses
  where name % search_query
     or name ilike '%' || search_query || '%'
  order by
    similarity(name, search_query) desc,
    name asc
  limit result_limit;
$$;

grant execute on function public.search_courses(text, int) to anon, authenticated;
