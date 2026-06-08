begin;

alter table public.supplier_advance_payments
  drop constraint if exists supplier_advance_payments_status_check;

update public.supplier_advance_payments
set
  status = case
    when cancelled_at is not null or status = 'cancelled' then 'cancelled'
    when allocated_amount > 0.01 and remaining_amount <= 0.01 then 'allocated'
    when allocated_amount > 0.01 then 'partially_allocated'
    else 'paid'
  end,
  updated_at = now()
where status in ('refunding', 'refunded');

with active_payment_totals as (
  select
    p.payment_approval_id,
    sum(coalesce(p.amount, 0) + coalesce(p.withholding_tax, 0) + coalesce(p.discount, 0)) as settled_amount
  from public.payments p
  where coalesce(p.status, '') <> 'cancelled'
    and p.payment_approval_id is not null
  group by p.payment_approval_id
),
active_approvals as (
  select
    pa.source_id::bigint as advance_payment_id,
    count(*) as active_approval_count,
    sum(coalesce(pa.approved_amount, 0)) as active_approval_amount,
    bool_and(coalesce(apt.settled_amount, 0) >= coalesce(pa.approved_amount, 0) - 0.01) as all_active_approvals_settled
  from public.payment_approvals pa
  left join active_payment_totals apt on apt.payment_approval_id = pa.id
  where pa.source_type = 'advance_payment'
    and pa.status in ('approved', 'paid')
    and pa.source_id ~ '^[0-9]+$'
  group by pa.source_id::bigint
),
computed_status as (
  select
    sap.id,
    case
      when sap.cancelled_at is not null or sap.status = 'cancelled' then 'cancelled'
      when sap.allocated_amount > 0.01 and sap.remaining_amount <= 0.01 then 'allocated'
      when sap.allocated_amount > 0.01 then 'partially_allocated'
      when coalesce(aa.active_approval_amount, 0) <= 0.01 then 'pending_approval'
      when coalesce(aa.active_approval_amount, 0) < sap.amount - 0.01 then 'partially_approved'
      when coalesce(aa.all_active_approvals_settled, false) then 'paid'
      else 'approved'
    end as next_status
  from public.supplier_advance_payments sap
  left join active_approvals aa on aa.advance_payment_id = sap.id
)
update public.supplier_advance_payments sap
set
  status = computed_status.next_status,
  updated_at = now()
from computed_status
where computed_status.id = sap.id
  and sap.status is distinct from computed_status.next_status;

alter table public.supplier_advance_payments
  add constraint supplier_advance_payments_status_check check (status in (
    'pending_approval',
    'partially_approved',
    'approved',
    'paid',
    'partially_allocated',
    'allocated',
    'cancelled'
  ));

commit;
