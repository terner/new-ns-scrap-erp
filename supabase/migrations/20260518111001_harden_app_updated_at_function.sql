-- Harden app trigger function search_path.
-- Additive/non-destructive: replaces function body metadata only.

create or replace function public.app_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
