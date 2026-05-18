create schema if not exists maintenance;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'suppliers'
      and column_name = 'contact'
  ) then
    create table if not exists maintenance.supplier_contact_backup_20260518 as
    select
      id,
      code,
      name,
      contact,
      contact_title,
      contact_first_name,
      contact_last_name,
      now() as backed_up_at
    from public.suppliers
    where contact is not null
      or contact_title is not null
      or contact_first_name is not null
      or contact_last_name is not null;
  end if;
end $$;

alter table public.suppliers
  drop column if exists contact,
  drop column if exists contact_title,
  drop column if exists contact_first_name,
  drop column if exists contact_last_name;
