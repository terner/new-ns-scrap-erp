drop function if exists public.current_app_user_id();

create function public.current_app_user_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select au.id
  from public.app_users au
  where au.auth_user_id = auth.uid()
    and au.active = true
  limit 1;
$$;

grant execute on function public.current_app_user_id() to authenticated;
