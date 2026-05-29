create table if not exists public.payment_approvals (
  id text primary key,
  source_type text not null,
  source_id text not null,
  source_doc_no_snapshot text,
  source_date_snapshot date,
  party_id text,
  party_name_snapshot text,
  approved_amount numeric not null default 0,
  destination_bank_account_id_snapshot text,
  destination_bank_name_snapshot text,
  destination_account_no_snapshot text,
  destination_payment_method_snapshot text,
  note text,
  status text not null default 'approved',
  approved_by text,
  approved_at timestamptz,
  paid_at timestamptz,
  payment_id text,
  voided_at timestamptz,
  voided_by text,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_approvals_status_chk check (status in ('approved', 'paid', 'voided'))
);

create index if not exists idx_payment_approvals_source
  on public.payment_approvals (source_type, source_id);

create index if not exists idx_payment_approvals_status
  on public.payment_approvals (status);

create index if not exists idx_payment_approvals_approved_at
  on public.payment_approvals (approved_at desc);

alter table public.payments
  add column if not exists payment_approval_id text;

create index if not exists idx_payments_payment_approval
  on public.payments (payment_approval_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payments_payment_approval_id_fkey'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_payment_approval_id_fkey
      foreign key (payment_approval_id) references public.payment_approvals(id)
      on delete no action
      on update no action;
  end if;
end $$;
