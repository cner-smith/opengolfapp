-- search_courses' ILIKE fallback (0018) spliced the raw term into the
-- pattern, so a search for "%" or "_" matched every course (#919). Escape
-- LIKE's metacharacters — backslash first, it's the default ESCAPE — so the
-- term matches literally. The trigram arm is untouched: it ignores
-- non-alphanumerics, so "%" / "_" produce no trigrams and match nothing.

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
     or name ilike '%' || replace(replace(replace(search_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by
    similarity(name, search_query) desc,
    name asc
  limit result_limit;
$$;

grant execute on function public.search_courses(text, int) to anon, authenticated;
