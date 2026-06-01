-- 0036_account_deletion_rpc.sql
-- Self-service account deletion (App Store Guideline 5.1.1(v): apps that
-- support account creation must allow account deletion from inside the app).
--
-- Every user-owned table cascades off auth.users, so deleting the caller's
-- auth row wipes ALL of their data with no per-table DELETEs:
--
--   auth.users ─cascade→ profiles ─cascade→ rounds ─cascade→ hole_scores
--                                                   └cascade→ shots
--                                  profiles ─cascade→ shots, practice_plans
--   auth.users ─cascade→ user_clubs
--
-- We do NOT call auth.admin.delete_user — that is the service-role GoTrue
-- API and is not callable from SQL. A direct DELETE on auth.users is the
-- supported SQL path (Supabase "User Management" docs). The auth sub-tables
-- (sessions, identities, refresh_tokens) also cascade off auth.users(id),
-- so the auth side is cleaned too.
--
-- SECURITY DEFINER so the function runs as its owner (which can delete from
-- auth.users); the auth.uid() guard ensures a caller can only ever delete
-- its own account. search_path pinned to '' per house convention (0032) —
-- every reference is fully schema-qualified, so no search_path injection.
--
-- Caveat handled by the client: deleting the auth row does not invalidate an
-- already-issued JWT, so the mobile flow calls supabase.auth.signOut()
-- immediately after this returns. (OGA uses no Supabase Storage, so the
-- "can't delete a user who owns Storage objects" caveat does not apply.)
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

-- Destructive + irreversible: only signed-in users may call it, never anon.
-- Supabase's default privileges auto-grant EXECUTE on new functions to anon
-- too, so revoke anon explicitly (revoking from `public` alone leaves the
-- per-role grant in place). The auth.uid() guard already blocks an anon call,
-- but anon should not hold the grant at all.
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
