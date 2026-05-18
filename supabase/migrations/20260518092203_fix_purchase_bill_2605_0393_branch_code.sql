create schema if not exists maintenance;

create table if not exists maintenance.purchase_bill_samut_sakhon_renumber_backup_20260518 (
  purchase_bill_id text primary key,
  before_data jsonb not null,
  backed_up_at timestamptz not null default now()
);

insert into maintenance.purchase_bill_samut_sakhon_renumber_backup_20260518 (purchase_bill_id, before_data)
select id, to_jsonb(p)
from public.purchase_bills p
on conflict do nothing;

with ordered as (
  select
    id,
    date,
    row_number() over (
      partition by to_char(date, 'YYMM')
      order by
        nullif(split_part(doc_no, '-', 2), '')::int nulls last,
        date,
        id
    ) as running_no
  from public.purchase_bills
)
update public.purchase_bills p
set doc_no = 'PB01' || to_char(p.date, 'YYMM') || '-' || lpad(ordered.running_no::text, 4, '0'),
    branch_id = 'BR002',
    warehouse_id = 'WH002',
    updated_at = now()
from ordered
where ordered.id = p.id;
