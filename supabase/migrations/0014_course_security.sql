-- Course/profile validation + course_tees write lockdown.
--
-- 1. handle_new_user() trustingly copies raw_user_meta_data->>'username'
--    into profiles.username with no validation. Any signup posts arbitrary
--    text (HTML, control chars, multi-KB strings) into a column rendered
--    across the app. Reject malformed usernames; fall back to a synthetic
--    user_<uuid8> so the trigger never aborts the signup.
--
-- 2. courses INSERT is open to any authenticated user (0001 RLS) with no
--    length cap or charset filter on `name`. A single signed-in user can
--    spam thousands of courses or inject HTML/script-shaped strings that
--    are publicly readable by every other user. CHECK constraints close
--    the obvious holes; rate limiting + moderation are still TODO.
--
-- 3. profiles.username gets the same charset rule the trigger now enforces
--    so existing rows can't drift into invalid territory via direct UPDATE.
--
-- 4. course_tees UPDATE was `auth.role() = 'authenticated'` per 0008 — any
--    user could overwrite any course's slope_rating/course_rating, which
--    feeds rounds.score_differential. Restrict to service_role until a
--    created_by ownership column lands (tracked in #72).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text := new.raw_user_meta_data ->> 'username';
  safe_username text;
begin
  if raw_username is not null and raw_username ~ '^[a-zA-Z0-9_-]{3,32}$' then
    safe_username := raw_username;
  else
    safe_username := 'user_' || substr(new.id::text, 1, 8);
  end if;

  insert into public.profiles (id, username)
  values (new.id, safe_username)
  on conflict (id) do nothing;
  return new;
end;
$$;

alter table public.courses
  add constraint courses_name_length
    check (char_length(name) between 2 and 100),
  add constraint courses_name_chars
    check (name ~ '^[^<>{}]*$');

alter table public.profiles
  add constraint username_format
    check (username is null or username ~ '^[a-zA-Z0-9_-]{3,32}$');

drop policy if exists "Authenticated users can update course tees" on public.course_tees;

create policy "Service role can update course tees"
  on public.course_tees for update
  using (auth.role() = 'service_role');
