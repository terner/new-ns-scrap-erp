create schema if not exists maintenance;
create table if not exists maintenance.product_type_unit_code_cleanup_backup_20260520125114_product_units as
select *
from public.product_units;
create table if not exists maintenance.product_type_unit_code_cleanup_backup_20260520125114_product_types as
select *
from public.product_types;
alter table public.product_units
  drop column if exists code;
alter table public.product_types
  drop column if exists code;
