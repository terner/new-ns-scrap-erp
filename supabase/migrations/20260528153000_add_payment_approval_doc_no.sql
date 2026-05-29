alter table public.payment_approvals
  add column if not exists doc_no text;

create unique index if not exists uq_payment_approvals_doc_no
  on public.payment_approvals (doc_no)
  where doc_no is not null;

create index if not exists idx_payment_approvals_doc_no
  on public.payment_approvals (doc_no);

with approval_base as (
  select
    pa.id,
    coalesce(b.code, '00') as branch_code,
    to_char(coalesce(pa.approved_at, pa.created_at, now()), 'YYMM') as period,
    row_number() over (
      partition by coalesce(b.code, '00'), to_char(coalesce(pa.approved_at, pa.created_at, now()), 'YYMM')
      order by coalesce(pa.approved_at, pa.created_at, now()), pa.id
    ) as seq
  from public.payment_approvals pa
  left join public.purchase_bills pb
    on pa.source_type = 'purchase_bill'
   and pa.source_id = pb.id
  left join public.expenses ex
    on pa.source_type = 'expense'
   and pa.source_id = ex.id
  left join public.branches b
    on b.id = coalesce(pb.branch_id, ex.branch_id)
  where pa.doc_no is null
)
update public.payment_approvals pa
set doc_no = format('PMA%s%s-%s', approval_base.branch_code, approval_base.period, lpad(approval_base.seq::text, 4, '0'))
from approval_base
where pa.id = approval_base.id
  and pa.doc_no is null;
