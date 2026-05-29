with duplicated as (
  select
    pa.id,
    pa.doc_no,
    split_part(pa.doc_no, '-', 1) as prefix,
    row_number() over (
      partition by pa.doc_no
      order by coalesce(pa.approved_at, pa.created_at), pa.created_at, pa.id
    ) as rn
  from public.payment_approvals pa
  where pa.doc_no is not null
),
prefix_max as (
  select
    split_part(pa.doc_no, '-', 1) as prefix,
    max(coalesce(nullif(split_part(pa.doc_no, '-', 2), ''), '0')::int) as max_running
  from public.payment_approvals pa
  where pa.doc_no is not null
  group by 1
),
to_renumber as (
  select
    d.id,
    d.prefix,
    row_number() over (
      partition by d.prefix
      order by coalesce(pa.approved_at, pa.created_at), pa.created_at, pa.id
    ) as seq
  from duplicated d
  join public.payment_approvals pa on pa.id = d.id
  where d.rn > 1
),
new_doc_nos as (
  select
    tr.id,
    format('%s-%s', tr.prefix, lpad((pm.max_running + tr.seq)::text, 4, '0')) as next_doc_no
  from to_renumber tr
  join prefix_max pm on pm.prefix = tr.prefix
)
update public.payment_approvals pa
set doc_no = ndn.next_doc_no
from new_doc_nos ndn
where pa.id = ndn.id;

drop index if exists public.idx_payment_approvals_doc_no;

create unique index if not exists uq_payment_approvals_doc_no
  on public.payment_approvals (doc_no)
  where doc_no is not null;

create index if not exists idx_payment_approvals_doc_no
  on public.payment_approvals (doc_no);
