-- 0032_plan_global_count.sql
-- Global spend backstop for the generate-practice-plan Edge Function (§11 / D15).
--
-- The orchestrator runs as the CALLER (anon key + the user's JWT) so all reads
-- are RLS-scoped — it can see only its own practice_plans rows and therefore
-- CANNOT count(*) across all users to enforce a global monthly ceiling. This
-- SECURITY DEFINER function provides exactly that one elevated read, and nothing
-- more: it returns ONLY an integer count (never any row data), is `stable`, and
-- pins `search_path = ''` so every reference is fully schema-qualified and no
-- search_path injection is possible. The caller compares the result against
-- GLOBAL_MONTHLY_CAP and falls back to a baseline plan (no Claude) when tripped.
create or replace function public.plan_generations_this_month()
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::int
  from public.practice_plans
  where generated_at >= date_trunc('month', now());
$$;

grant execute on function public.plan_generations_this_month() to authenticated;
