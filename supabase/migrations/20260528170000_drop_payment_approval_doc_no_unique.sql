drop index if exists public.uq_payment_approvals_doc_no;

create index if not exists idx_payment_approvals_doc_no
  on public.payment_approvals (doc_no);
