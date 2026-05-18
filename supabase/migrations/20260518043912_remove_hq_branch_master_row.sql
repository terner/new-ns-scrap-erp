create schema if not exists maintenance;

create table if not exists maintenance.branch_hq_removal_backup_20260518 (
  source_table text not null,
  source_id text not null,
  branch_id text,
  branch_code text,
  branch_name text,
  backed_up_at timestamptz not null default now(),
  primary key (source_table, source_id)
);

insert into maintenance.branch_hq_removal_backup_20260518 (source_table, source_id, branch_id, branch_code, branch_name)
select 'branches', id, id, code, name
from public.branches
where id = 'BR001'
  and code = 'HQ'
on conflict do nothing;

insert into maintenance.branch_hq_removal_backup_20260518 (source_table, source_id, branch_id, branch_code, branch_name)
select 'accounts', id, branch_id, 'HQ', 'สำนักงานใหญ่'
from public.accounts
where branch_id = 'BR001'
on conflict do nothing;

insert into maintenance.branch_hq_removal_backup_20260518 (source_table, source_id, branch_id, branch_code, branch_name)
select 'expenses', id, branch_id, 'HQ', 'สำนักงานใหญ่'
from public.expenses
where branch_id = 'BR001'
on conflict do nothing;

insert into maintenance.branch_hq_removal_backup_20260518 (source_table, source_id, branch_id, branch_code, branch_name)
select 'purchase_bills', id, branch_id, 'HQ', 'สำนักงานใหญ่'
from public.purchase_bills
where branch_id = 'BR001'
on conflict do nothing;

insert into maintenance.branch_hq_removal_backup_20260518 (source_table, source_id, branch_id, branch_code, branch_name)
select 'stock_ledger', id, branch_id, 'HQ', 'สำนักงานใหญ่'
from public.stock_ledger
where branch_id = 'BR001'
on conflict do nothing;

insert into maintenance.branch_hq_removal_backup_20260518 (source_table, source_id, branch_id, branch_code, branch_name)
select 'warehouses', id, branch_id, 'HQ', 'สำนักงานใหญ่'
from public.warehouses
where branch_id = 'BR001'
on conflict do nothing;

update public.accounts
set branch_id = null
where branch_id = 'BR001';

update public.expenses
set branch_id = null
where branch_id = 'BR001';

update public.purchase_bills
set branch_id = null
where branch_id = 'BR001';

update public.stock_ledger
set branch_id = null
where branch_id = 'BR001';

update public.warehouses
set branch_id = null
where branch_id = 'BR001';

delete from public.branches
where id = 'BR001'
  and code = 'HQ';
