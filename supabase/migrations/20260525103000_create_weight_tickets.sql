create table if not exists public.weight_tickets (
  id text primary key,
  doc_no text not null unique,
  doc_type text not null,
  status text not null default 'received',
  document_date date not null,
  branch_id text not null references public.branches(id) on update no action on delete no action,
  supplier_id text references public.suppliers(id) on update no action on delete no action,
  customer_id text references public.customers(id) on update no action on delete no action,
  party_name text not null,
  vehicle_no text not null,
  remark text,
  entered_by text,
  image_count integer not null default 0,
  vehicle_image_count integer not null default 0,
  vehicle_image_names text[] not null default array[]::text[],
  gross_weight numeric not null default 0,
  deduct_weight numeric not null default 0,
  net_weight numeric not null default 0,
  cancel_note text,
  cancelled_at timestamptz,
  cancelled_by text,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint weight_tickets_type_ck check (doc_type in ('WTI', 'WTO')),
  constraint weight_tickets_status_ck check (status in ('received', 'delivered', 'partially_billed', 'billed', 'cancelled')),
  constraint weight_tickets_party_ck check (
    (doc_type = 'WTI' and supplier_id is not null and customer_id is null)
    or (doc_type = 'WTO' and customer_id is not null and supplier_id is null)
  )
);

create index if not exists idx_weight_tickets_branch on public.weight_tickets(branch_id);
create index if not exists idx_weight_tickets_customer on public.weight_tickets(customer_id);
create index if not exists idx_weight_tickets_doc_no on public.weight_tickets(doc_no);
create index if not exists idx_weight_tickets_doc_type on public.weight_tickets(doc_type);
create index if not exists idx_weight_tickets_date on public.weight_tickets(document_date desc);
create index if not exists idx_weight_tickets_status on public.weight_tickets(status);
create index if not exists idx_weight_tickets_supplier on public.weight_tickets(supplier_id);

create table if not exists public.weight_ticket_lines (
  id text primary key,
  weight_ticket_id text not null references public.weight_tickets(id) on update no action on delete cascade,
  line_no integer not null,
  product_id text not null references public.products(id) on update no action on delete no action,
  product_name text not null,
  gross_weight numeric not null default 0,
  deduct_weight numeric not null default 0,
  net_weight numeric not null default 0,
  deduction_mode text not null,
  deduction_value numeric default 0,
  impurity_id text references public.impurities(id) on update no action on delete no action,
  impurity_name text,
  note text,
  image_count integer not null default 0,
  image_names text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  constraint uq_weight_ticket_lines_ticket_line unique (weight_ticket_id, line_no),
  constraint weight_ticket_lines_deduction_mode_ck check (deduction_mode in ('none', 'kg', 'percent'))
);

create index if not exists idx_weight_ticket_lines_impurity on public.weight_ticket_lines(impurity_id);
create index if not exists idx_weight_ticket_lines_product on public.weight_ticket_lines(product_id);
create index if not exists idx_weight_ticket_lines_ticket on public.weight_ticket_lines(weight_ticket_id);
