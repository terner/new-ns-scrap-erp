create schema if not exists maintenance;
create table if not exists maintenance.customer_contact_bank_cleanup_backup_20260520124507 as
select
  id,
  code,
  name,
  contact,
  contact_title,
  contact_first_name,
  contact_last_name,
  bank_name,
  bank_account,
  notes,
  updated_at
from public.customers
where contact is not null
   or contact_title is not null
   or contact_first_name is not null
   or contact_last_name is not null
   or bank_name is not null
   or bank_account is not null
   or notes is not null;
alter table public.customers
  add column if not exists country_code text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists address_city text,
  add column if not exists address_state_region text,
  add column if not exists address_postal_code_intl text;
update public.customers
set
  country_code = case when coalesce(market_scope, 'ในประเทศ') = 'ในประเทศ' then 'TH' else country_code end,
  address_line1 = coalesce(address_line1, nullif(trim(concat_ws(' ', address_no, case when address_moo is not null then 'หมู่ ' || address_moo end, address_village, address_road)), '')),
  address_city = coalesce(address_city, address_district),
  address_state_region = coalesce(address_state_region, address_province),
  address_postal_code_intl = coalesce(address_postal_code_intl, address_postal_code)
where coalesce(market_scope, 'ในประเทศ') = 'ในประเทศ';
alter table public.customers
  drop column if exists contact,
  drop column if exists contact_title,
  drop column if exists contact_first_name,
  drop column if exists contact_last_name,
  drop column if exists bank_name,
  drop column if exists bank_account,
  drop column if exists notes;
create index if not exists idx_customers_country_code on public.customers (country_code);
