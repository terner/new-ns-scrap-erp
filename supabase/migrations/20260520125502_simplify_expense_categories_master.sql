create schema if not exists maintenance;

create table if not exists maintenance.expense_categories_parent_cleanup_backup_20260520125502 as
select *
from public.expense_categories;

alter table public.expense_categories
  drop column if exists parent_id;
