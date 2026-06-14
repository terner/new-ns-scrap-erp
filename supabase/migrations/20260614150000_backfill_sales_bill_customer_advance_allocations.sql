create unique index if not exists uq_sales_bill_customer_advance_allocations_active_bill_advance
  on public.sales_bill_customer_advance_allocations(sales_bill_id, customer_advance_doc_no)
  where status = 'active';

with legacy_allocations as (
  select
    b.id as sales_bill_id,
    b.customer_id,
    b.paid_amount,
    b.created_at,
    b.created_by,
    b.updated_at,
    b.updated_by,
    ca.customer_advance_doc_no
  from public.sales_bills b
  cross join lateral (
    select item.value ->> 'customerAdvanceId' as customer_advance_doc_no
    from jsonb_array_elements(
      case
        when jsonb_typeof(b.items) = 'array' then b.items
        else '[]'::jsonb
      end
    ) as item(value)
    where coalesce(item.value ->> 'customerAdvanceId', '') <> ''
    limit 1
  ) ca
  where coalesce(b.paid_amount, 0) > 0
    and b.status not in ('cancelled', 'Cancelled', 'void', 'voided')
),
ranked_allocations as (
  select
    l.*,
    bs.amount_in as advance_amount,
    coalesce(
      sum(l.paid_amount) over (
        partition by l.customer_advance_doc_no
        order by l.created_at, l.sales_bill_id
        rows between unbounded preceding and 1 preceding
      ),
      0
    ) as allocated_before
  from legacy_allocations l
  join public.bank_statement bs
    on bs.doc_no = l.customer_advance_doc_no
   and bs.ref_type = 'CADV'
),
prepared_allocations as (
  select
    r.sales_bill_id,
    r.customer_advance_doc_no,
    r.customer_id,
    coalesce(c.code, bs.ref_id, '') as customer_code_snapshot,
    coalesce(c.name, bs.ref_no, '') as customer_name_snapshot,
    least(r.paid_amount, greatest(r.advance_amount - r.allocated_before, 0)) as allocated_amount,
    greatest(r.advance_amount - r.allocated_before, 0) as outstanding_before,
    greatest(r.advance_amount - r.allocated_before - least(r.paid_amount, greatest(r.advance_amount - r.allocated_before, 0)), 0) as outstanding_after,
    r.created_at,
    r.created_by,
    r.updated_at,
    r.updated_by
  from ranked_allocations r
  join public.bank_statement bs
    on bs.doc_no = r.customer_advance_doc_no
   and bs.ref_type = 'CADV'
  left join public.customers c
    on c.id = r.customer_id
)
insert into public.sales_bill_customer_advance_allocations (
  sales_bill_id,
  customer_advance_doc_no,
  customer_id,
  customer_code_snapshot,
  customer_name_snapshot,
  allocated_amount,
  outstanding_before,
  outstanding_after,
  status,
  notes,
  meta,
  created_at,
  created_by,
  updated_at,
  updated_by
)
select
  p.sales_bill_id,
  p.customer_advance_doc_no,
  p.customer_id,
  p.customer_code_snapshot,
  p.customer_name_snapshot,
  p.allocated_amount,
  p.outstanding_before,
  p.outstanding_after,
  'active',
  'Backfilled from legacy sales_bills.items customerAdvanceId marker',
  jsonb_build_object('source', 'legacy_sales_bills_items_backfill'),
  p.created_at,
  p.created_by,
  p.updated_at,
  p.updated_by
from prepared_allocations p
where p.allocated_amount > 0
  and not exists (
    select 1
    from public.sales_bill_customer_advance_allocations existing
    where existing.sales_bill_id = p.sales_bill_id
      and existing.customer_advance_doc_no = p.customer_advance_doc_no
      and existing.status = 'active'
  );
