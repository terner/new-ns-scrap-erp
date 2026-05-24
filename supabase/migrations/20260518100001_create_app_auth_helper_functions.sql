-- App auth helper functions for route/API guards.
-- Additive/non-destructive: reads app_* tables without changing legacy auth structures.

create or replace function public.current_app_user_id()
returns uuid
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
create or replace function public.current_app_role_codes()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct ar.code order by ar.code), array[]::text[])
  from public.app_users au
  join public.app_user_roles aur on aur.user_id = au.id
  join public.app_roles ar on ar.id = aur.role_id
  where au.auth_user_id = auth.uid()
    and au.active = true
    and ar.active = true;
$$;
create or replace function public.current_app_permission_codes()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct ap.code order by ap.code), array[]::text[])
  from public.app_users au
  join public.app_user_roles aur on aur.user_id = au.id
  join public.app_roles ar on ar.id = aur.role_id
  join public.app_role_permissions arp on arp.role_id = ar.id
  join public.app_permissions ap on ap.id = arp.permission_id
  where au.auth_user_id = auth.uid()
    and au.active = true
    and ar.active = true
    and ap.active = true;
$$;
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from unnest(public.current_app_role_codes()) as role_code
    where role_code in ('admin', 'owner')
  );
$$;
create or replace function public.has_app_permission(_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_app_admin()
    or _permission_code = any(public.current_app_permission_codes());
$$;
grant execute on function public.current_app_user_id() to authenticated;
grant execute on function public.current_app_role_codes() to authenticated;
grant execute on function public.current_app_permission_codes() to authenticated;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.has_app_permission(text) to authenticated;
