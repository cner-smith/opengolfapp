-- 0062: admin_odd_hole_course_count, for the dev-only admin dashboard (#1144).
--
-- Courses that have some hole rows but neither 9 nor 18 of them. The dashboard
-- used to download every holes row (~195k on prod, 1000 per request) to count
-- this client-side, which took ~20 s per load. Courses with no hole rows don't
-- count, as before. Service role only: the dashboard runs with that key.
create or replace function public.admin_odd_hole_course_count()
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::int
    from (
      select course_id
        from public.holes
       group by course_id
      having count(*) not in (9, 18)
    ) odd;
$$;

revoke execute on function public.admin_odd_hole_course_count() from public, anon, authenticated;
grant  execute on function public.admin_odd_hole_course_count() to service_role;
