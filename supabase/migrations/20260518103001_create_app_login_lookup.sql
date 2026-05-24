-- Login identifier lookup for username-based Supabase Auth sign-in.
-- Returns the email for an active app user so the client can call Supabase Auth signInWithPassword.
-- Does not read or expose legacy public.users.password.

create or replace function public.lookup_app_login_email(_identifier text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select au.email
  from public.app_users au
  where au.active = true
    and au.email is not null
    and (
      lower(au.username) = lower(btrim(_identifier))
      or lower(au.email) = lower(btrim(_identifier))
    )
  order by au.created_at desc
  limit 1;
$$;
grant execute on function public.lookup_app_login_email(text) to anon;
grant execute on function public.lookup_app_login_email(text) to authenticated;
