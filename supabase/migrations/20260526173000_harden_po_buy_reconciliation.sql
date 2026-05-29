alter table public.po_buys
  add column if not exists short_closed_qty numeric default 0,
  add column if not exists short_closed_amount numeric default 0,
  add column if not exists short_closed_note text,
  add column if not exists short_closed_at timestamptz,
  add column if not exists short_closed_by text;

create table if not exists public.po_buy_status_logs (
  id text primary key,
  po_buy_id text not null references public.po_buys(id) on delete cascade,
  status text not null,
  note text,
  meta jsonb,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists idx_po_buy_status_logs_po_created
  on public.po_buy_status_logs (po_buy_id, created_at desc);

with allocation_totals as (
  select
    ppa.po_buy_id,
    coalesce(sum(ppa.allocated_qty), 0) as allocated_qty,
    coalesce(sum(ppa.allocated_amount), 0) as allocated_amount
  from public.purchase_bill_po_allocations ppa
  join public.purchase_bills pb
    on pb.id = ppa.purchase_bill_id
  where coalesce(lower(pb.status), '') <> 'cancelled'
  group by ppa.po_buy_id
)
update public.po_buys po
set
  cut_amount = greatest(
    0,
    coalesce(po.total_amount, 0) - case
      when po.short_closed_at is not null and (coalesce(po.short_closed_qty, 0) > 0 or coalesce(po.short_closed_amount, 0) > 0)
        then 0
      else greatest(0, coalesce(po.total_amount, 0) - coalesce(at.allocated_amount, 0))
    end
  ),
  remaining_amount = case
    when po.status = 'Cancelled' then 0
    when po.short_closed_at is not null and (coalesce(po.short_closed_qty, 0) > 0 or coalesce(po.short_closed_amount, 0) > 0) then 0
    else greatest(0, coalesce(po.total_amount, 0) - coalesce(at.allocated_amount, 0))
  end,
  remaining_qty = case
    when po.status = 'Cancelled' then 0
    when po.short_closed_at is not null and (coalesce(po.short_closed_qty, 0) > 0 or coalesce(po.short_closed_amount, 0) > 0) then 0
    else greatest(0, coalesce(po.qty, 0) - coalesce(at.allocated_qty, 0))
  end,
  status = case
    when po.status = 'Cancelled' then 'Cancelled'
    when po.short_closed_at is not null and (coalesce(po.short_closed_qty, 0) > 0 or coalesce(po.short_closed_amount, 0) > 0) then 'Short Closed'
    when greatest(0, coalesce(po.qty, 0) - coalesce(at.allocated_qty, 0)) <= 0.0001 then 'Received'
    when greatest(0, coalesce(po.qty, 0) - coalesce(at.allocated_qty, 0)) >= greatest(0, coalesce(po.qty, 0) - 0.0001) then 'Open'
    else 'Partially Received'
  end
from allocation_totals at
where po.id = at.po_buy_id;

with untouched as (
  select
    po.id,
    case
      when po.status = 'Cancelled' then 'Cancelled'
      when po.short_closed_at is not null and (coalesce(po.short_closed_qty, 0) > 0 or coalesce(po.short_closed_amount, 0) > 0) then 'Short Closed'
      when coalesce(po.qty, 0) <= 0.0001 then 'Open'
      else 'Open'
    end as next_status
  from public.po_buys po
  where not exists (
    select 1
    from public.purchase_bill_po_allocations ppa
    join public.purchase_bills pb on pb.id = ppa.purchase_bill_id
    where ppa.po_buy_id = po.id
      and coalesce(lower(pb.status), '') <> 'cancelled'
  )
)
update public.po_buys po
set
  cut_amount = case when untouched.next_status = 'Cancelled' then coalesce(po.cut_amount, 0) else 0 end,
  remaining_amount = case
    when untouched.next_status = 'Cancelled' then 0
    when untouched.next_status = 'Short Closed' then 0
    else coalesce(po.total_amount, 0)
  end,
  remaining_qty = case
    when untouched.next_status = 'Cancelled' then 0
    when untouched.next_status = 'Short Closed' then 0
    else coalesce(po.qty, 0)
  end,
  status = untouched.next_status
from untouched
where po.id = untouched.id;

insert into public.po_buy_status_logs (id, po_buy_id, status, note, meta, created_at, created_by)
select
  'POL-' || replace(gen_random_uuid()::text, '-', ''),
  po.id,
  coalesce(po.status, 'Open'),
  null,
  jsonb_build_object('reason', 'migration_backfill'),
  coalesce(po.updated_at, po.created_at, now()),
  coalesce(po.updated_by, po.created_by)
from public.po_buys po
where not exists (
  select 1
  from public.po_buy_status_logs log
  where log.po_buy_id = po.id
);
