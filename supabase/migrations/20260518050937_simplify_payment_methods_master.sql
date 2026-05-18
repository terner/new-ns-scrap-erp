create schema if not exists maintenance;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payment_methods'
      and column_name = 'type'
  ) then
    create table if not exists maintenance.payment_method_type_backup_20260518 as
    select
      id,
      code,
      name,
      type,
      now() as backed_up_at
    from public.payment_methods
    where type is not null
      and btrim(type) <> '';
  end if;
end $$;

alter table public.payment_methods
  drop column if exists type,
  drop column if exists bank_name,
  drop column if exists account_no;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'overseas_remittance_purposes'
      and column_name = 'required_doc'
  ) then
    create table if not exists maintenance.remittance_purpose_required_doc_backup_20260518 as
    select
      id,
      code,
      name,
      required_doc,
      now() as backed_up_at
    from public.overseas_remittance_purposes
    where required_doc is not null
      and btrim(required_doc) <> '';
  end if;
end $$;

alter table public.overseas_remittance_purposes
  drop column if exists required_doc;
