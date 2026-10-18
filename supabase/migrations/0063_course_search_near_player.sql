-- search_courses ranks courses near the player higher (#898). It ranked by
-- name similarity alone and returned the top 10, so a short or common search
-- ("lake", "pines") buried the course down the road: from Oklahoma City,
-- "lake" put Lake Hefner 25th, off the list.
--
-- With user_lat / user_lng the score is similarity plus a closeness bonus of
-- up to 0.4 that halves about every 28 km (0.4·e^(−km/40)): a nearby partial
-- match beats a distant one, and an exact name (similarity 1) far away beats a
-- nearby near-miss; only a nearby name that is already very close (similarity
-- over 0.6) can tie it. Without a position, or for a course with no lat/lng,
-- the bonus is 0 and the order is as before.
--
-- Dropped and recreated (not replaced): a second overload with the old two
-- arguments would make PostgREST's two-argument call ambiguous. Older app
-- builds keep working: the new arguments default to null. security invoker,
-- so courses' RLS (0053: pending courses only for their submitter) applies.

drop function if exists public.search_courses(text, int);

create function public.search_courses(
  search_query text,
  result_limit int default 10,
  user_lat double precision default null,
  user_lng double precision default null
)
returns setof public.courses
language sql
stable
security invoker
set search_path = public
as $$
  select c.*
  from public.courses c
  where c.name % search_query
     or c.name ilike
          '%' || replace(replace(replace(search_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by
    similarity(c.name, search_query)
      + coalesce(
          0.4 * exp(
            -6371 * 2 * asin(least(1, sqrt(
              sin(radians(c.lat - user_lat) / 2) ^ 2
              + cos(radians(user_lat)) * cos(radians(c.lat))
                * sin(radians(c.lng - user_lng) / 2) ^ 2
            ))) / 40
          ),
          0
        ) desc,
    c.name asc
  limit result_limit;
$$;

grant execute on function public.search_courses(text, int, double precision, double precision)
  to anon, authenticated;
