create schema if not exists maintenance;

create table if not exists maintenance.branch_code_backup_20260518 (
  branch_id text primary key,
  before_code text,
  before_name text,
  backed_up_at timestamptz not null default now()
);

insert into maintenance.branch_code_backup_20260518 (branch_id, before_code, before_name)
select id, code, name
from public.branches
where id in ('BR002', 'BR003')
on conflict do nothing;

update public.branches
set code = '01',
    updated_at = now()
where id = 'BR002'
  and name = 'สมุทรสาคร';

update public.branches
set code = '02',
    updated_at = now()
where id = 'BR003'
  and name = 'นครสวรรค์';
