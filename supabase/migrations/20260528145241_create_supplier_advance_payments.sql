create table if not exists public.supplier_advance_payments (
  id text primary key,
  doc_no text not null unique,
  branch_id text not null references public.branches(id) on delete restrict,
  supplier_id text not null references public.suppliers(id) on delete restrict,
  advance_date date not null,
  amount numeric not null default 0,
  allocated_amount numeric not null default 0,
  remaining_amount numeric not null default 0,
  payment_method text not null,
  funding_account_id text references public.accounts(id) on delete restrict,
  status text not null default 'pending_approval',
  large_scale_doc_no text,
  in_date date,
  out_date date,
  plate_no text,
  vehicle_photo_url text,
  customer_name text,
  product_name text,
  weight_in numeric not null default 0,
  weight_out numeric not null default 0,
  net_weight numeric not null default 0,
  price_per_kg numeric not null default 0,
  scale_operator text,
  sender_name text,
  driver_name text,
  remark text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text,
  cancel_reason text,
  version integer not null default 1,
  constraint supplier_advance_payments_amount_check check (amount > 0),
  constraint supplier_advance_payments_allocated_amount_check check (allocated_amount >= 0 and allocated_amount <= amount),
  constraint supplier_advance_payments_remaining_amount_check check (remaining_amount >= 0 and remaining_amount <= amount),
  constraint supplier_advance_payments_weight_check check (weight_in >= 0 and weight_out >= 0 and net_weight >= 0),
  constraint supplier_advance_payments_price_check check (price_per_kg >= 0),
  constraint supplier_advance_payments_status_check check (status in (
    'pending_approval',
    'approved',
    'paid',
    'partially_allocated',
    'allocated',
    'refunding',
    'refunded',
    'cancelled'
  ))
);

create index if not exists idx_supplier_advance_payments_branch
  on public.supplier_advance_payments(branch_id);

create index if not exists idx_supplier_advance_payments_supplier
  on public.supplier_advance_payments(supplier_id);

create index if not exists idx_supplier_advance_payments_account
  on public.supplier_advance_payments(funding_account_id);

create index if not exists idx_supplier_advance_payments_date
  on public.supplier_advance_payments(advance_date desc);

create index if not exists idx_supplier_advance_payments_status
  on public.supplier_advance_payments(status);

create table if not exists public.supplier_advance_allocations (
  id text primary key,
  advance_payment_id text not null references public.supplier_advance_payments(id) on delete restrict,
  purchase_bill_id text not null references public.purchase_bills(id) on delete restrict,
  allocated_amount numeric not null,
  status text not null default 'active',
  allocated_at timestamptz not null default now(),
  allocated_by text,
  voided_at timestamptz,
  voided_by text,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint supplier_advance_allocations_amount_check check (allocated_amount > 0),
  constraint supplier_advance_allocations_status_check check (status in ('active', 'voided'))
);

create index if not exists idx_supplier_advance_allocations_advance
  on public.supplier_advance_allocations(advance_payment_id);

create index if not exists idx_supplier_advance_allocations_bill
  on public.supplier_advance_allocations(purchase_bill_id);

create index if not exists idx_supplier_advance_allocations_status
  on public.supplier_advance_allocations(status);

alter table public.supplier_advance_payments enable row level security;
alter table public.supplier_advance_allocations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'supplier_advance_payments'
      and policyname = 'authenticated can read supplier advance payments'
  ) then
    create policy "authenticated can read supplier advance payments"
      on public.supplier_advance_payments
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'supplier_advance_payments'
      and policyname = 'authenticated can write supplier advance payments'
  ) then
    create policy "authenticated can write supplier advance payments"
      on public.supplier_advance_payments
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'supplier_advance_allocations'
      and policyname = 'authenticated can read supplier advance allocations'
  ) then
    create policy "authenticated can read supplier advance allocations"
      on public.supplier_advance_allocations
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'supplier_advance_allocations'
      and policyname = 'authenticated can write supplier advance allocations'
  ) then
    create policy "authenticated can write supplier advance allocations"
      on public.supplier_advance_allocations
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;

grant select, insert, update on table public.supplier_advance_payments to authenticated;
grant select, insert, update on table public.supplier_advance_allocations to authenticated;
