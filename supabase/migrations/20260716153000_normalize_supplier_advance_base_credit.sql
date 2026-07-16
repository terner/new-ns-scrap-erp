begin;

-- ADV cash settlement is gross, while allocation/remaining balances are always pre-VAT base credit.
update public.supplier_advance_allocations
set
  allocated_amount = round(coalesce(allocated_subtotal_amount, allocated_amount, 0)::numeric, 2),
  allocated_subtotal_amount = round(coalesce(allocated_subtotal_amount, allocated_amount, 0)::numeric, 2),
  allocated_vat_amount = round(coalesce(allocated_vat_amount, 0)::numeric, 2),
  allocated_total_amount = round((
    coalesce(allocated_subtotal_amount, allocated_amount, 0)
    + coalesce(allocated_vat_amount, 0)
  )::numeric, 2),
  updated_at = now();

with active_allocations as (
  select
    advance_payment_id,
    round(sum(allocated_subtotal_amount)::numeric, 2) as allocated_base_amount
  from public.supplier_advance_allocations
  where status = 'active'
  group by advance_payment_id
)
update public.supplier_advance_payments sap
set
  allocated_amount = least(
    round(sap.subtotal_amount::numeric, 2),
    coalesce(aa.allocated_base_amount, 0)
  ),
  remaining_amount = greatest(
    0,
    round(sap.subtotal_amount::numeric, 2) - coalesce(aa.allocated_base_amount, 0)
  ),
  updated_at = now()
from (select sap2.id from public.supplier_advance_payments sap2) target
left join active_allocations aa on aa.advance_payment_id = target.id
where sap.id = target.id;

with approval_summary as (
  select
    pa.source_id,
    round(sum(pa.approved_amount)::numeric, 2) as approved_amount,
    round(sum(coalesce(payment_totals.settled_amount, 0))::numeric, 2) as settled_amount
  from public.payment_approvals pa
  left join lateral (
    select sum(coalesce(p.amount, 0) + coalesce(p.withholding_tax, 0) + coalesce(p.discount, 0)) as settled_amount
    from public.payments p
    where p.payment_approval_id = pa.id
      and p.status is distinct from 'cancelled'
  ) payment_totals on true
  where pa.source_type = 'advance_payment'
    and pa.status in ('approved', 'paid')
  group by pa.source_id
)
update public.supplier_advance_payments sap
set status = case
  when sap.cancelled_at is not null or sap.status = 'cancelled' then 'cancelled'
  when sap.allocated_amount > 0.01 and sap.remaining_amount <= 0.01 then 'allocated'
  when sap.allocated_amount > 0.01 then 'partially_allocated'
  when coalesce(summary.settled_amount, 0) >= sap.total_amount - 0.01 then 'paid'
  when coalesce(summary.settled_amount, 0) > 0.01 then 'partially_paid'
  when coalesce(summary.approved_amount, 0) <= 0.01 then 'pending_approval'
  when summary.approved_amount < sap.total_amount - 0.01 then 'partially_approved'
  else 'approved'
end
from (select sap2.id from public.supplier_advance_payments sap2) target
left join approval_summary summary on summary.source_id = target.id::text
where sap.id = target.id;

do $$
begin
  if exists (
    select 1
    from public.supplier_advance_allocations
    where status = 'active'
    group by purchase_bill_id
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce one active ADV per purchase bill: duplicate active allocations exist';
  end if;
end
$$;

create unique index if not exists uq_supplier_advance_allocations_active_bill
  on public.supplier_advance_allocations (purchase_bill_id)
  where status = 'active';

alter table public.supplier_advance_payments
  alter column subtotal_amount type numeric(18,2) using round(subtotal_amount::numeric, 2),
  alter column vat_amount type numeric(18,2) using round(vat_amount::numeric, 2),
  alter column total_amount type numeric(18,2) using round(total_amount::numeric, 2),
  alter column amount type numeric(18,2) using round(amount::numeric, 2),
  alter column allocated_amount type numeric(18,2) using round(allocated_amount::numeric, 2),
  alter column remaining_amount type numeric(18,2) using round(remaining_amount::numeric, 2);

alter table public.supplier_advance_allocations
  alter column allocated_amount type numeric(18,2) using round(allocated_amount::numeric, 2),
  alter column allocated_subtotal_amount type numeric(18,2) using round(allocated_subtotal_amount::numeric, 2),
  alter column allocated_vat_amount type numeric(18,2) using round(allocated_vat_amount::numeric, 2),
  alter column allocated_total_amount type numeric(18,2) using round(allocated_total_amount::numeric, 2);

alter table public.supplier_advance_payments
  drop constraint if exists supplier_advance_payments_base_credit_balance_check,
  drop constraint if exists supplier_advance_payments_tax_breakdown_check,
  add constraint supplier_advance_payments_base_credit_balance_check
    check (abs((allocated_amount + remaining_amount) - subtotal_amount) <= 0.01),
  add constraint supplier_advance_payments_tax_breakdown_check
    check (
      abs(amount - total_amount) <= 0.01
      and abs((subtotal_amount + vat_amount) - total_amount) <= 0.01
    );

alter table public.supplier_advance_allocations
  drop constraint if exists supplier_advance_allocations_base_amount_check,
  drop constraint if exists supplier_advance_allocations_total_breakdown_check,
  add constraint supplier_advance_allocations_base_amount_check
    check (abs(allocated_amount - allocated_subtotal_amount) <= 0.01),
  add constraint supplier_advance_allocations_total_breakdown_check
    check (abs((allocated_subtotal_amount + allocated_vat_amount) - allocated_total_amount) <= 0.01);

alter table public.supplier_advance_payments
  validate constraint supplier_advance_payments_advance_type_check,
  validate constraint supplier_advance_payments_vat_type_check,
  validate constraint supplier_advance_payments_invoice_required_for_advance_invoice,
  validate constraint supplier_advance_payments_vat_breakdown_nonnegative;

alter table public.supplier_advance_allocations
  validate constraint supplier_advance_allocations_breakdown_nonnegative;

-- Reconcile PB monetary state from discount -> ADV base credit -> PB VAT -> actual PMT settlement.
with advance_by_bill as (
  select
    purchase_bill_id,
    round(sum(allocated_subtotal_amount)::numeric, 2) as allocated_base_amount
  from public.supplier_advance_allocations
  where status = 'active'
  group by purchase_bill_id
),
payment_by_bill as (
  select
    bill_id,
    round(sum(
      coalesce(amount, 0) + coalesce(withholding_tax, 0) + coalesce(discount, 0)
    )::numeric, 2) as paid_amount
  from public.payments
  where bill_id is not null
    and status is distinct from 'cancelled'
  group by bill_id
),
recalculated as (
  select
    pb.id,
    coalesce(pmt.paid_amount, 0) as paid_amount,
    greatest(
      0,
      round(
        case
          when coalesce(pb.has_vat, false)
            and pb.vat_type = 'INCLUDE'
            and coalesce(pb.vat_rate_percent, 0) > 0
          then greatest(0, pb.subtotal - coalesce(nullif(pb.discount_total, 0), pb.discount, 0))
            * 100 / (100 + pb.vat_rate_percent)
          else greatest(0, pb.subtotal - coalesce(nullif(pb.discount_total, 0), pb.discount, 0))
        end::numeric,
        2
      ) - adv.allocated_base_amount
    ) as taxable_base_amount,
    coalesce(pb.has_vat, false)
      and pb.vat_type <> 'NONE'
      and coalesce(pb.vat_rate_percent, 0) > 0 as has_vat,
    coalesce(pb.vat_rate_percent, 0) as vat_rate_percent
  from public.purchase_bills pb
  join advance_by_bill adv on adv.purchase_bill_id = pb.id
  left join payment_by_bill pmt on pmt.bill_id = pb.id
),
totals as (
  select
    id,
    paid_amount,
    taxable_base_amount,
    case
      when has_vat then round((taxable_base_amount * vat_rate_percent / 100)::numeric, 2)
      else 0::numeric
    end as vat_amount
  from recalculated
)
update public.purchase_bills pb
set
  paid_amount = totals.paid_amount,
  payable_balance = greatest(0, round((totals.taxable_base_amount + totals.vat_amount - totals.paid_amount)::numeric, 2)),
  status = case
    when totals.paid_amount >= totals.taxable_base_amount + totals.vat_amount - 0.01 then 'paid'
    when totals.paid_amount > 0 then 'partial'
    else 'unpaid'
  end,
  total_amount = round((totals.taxable_base_amount + totals.vat_amount)::numeric, 2),
  vat_amount = totals.vat_amount,
  updated_at = now()
from totals
where pb.id = totals.id;

commit;
