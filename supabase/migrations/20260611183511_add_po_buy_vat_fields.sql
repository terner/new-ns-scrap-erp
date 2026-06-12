alter table public.po_buys
  add column if not exists subtotal numeric default 0,
  add column if not exists has_vat boolean default false,
  add column if not exists vat_type text default 'NONE',
  add column if not exists vat_rate_percent numeric(5,2) not null default 7.00,
  add column if not exists vat_amount numeric default 0;

update public.po_buys
set
  subtotal = coalesce(subtotal, total_amount, 0),
  has_vat = coalesce(has_vat, false),
  vat_type = coalesce(vat_type, case when coalesce(has_vat, false) then 'EXCLUDE' else 'NONE' end),
  vat_rate_percent = coalesce(vat_rate_percent, 7.00),
  vat_amount = coalesce(vat_amount, 0);

alter table public.po_buys
  alter column vat_rate_percent set default 7.00,
  alter column vat_rate_percent set not null;

alter table public.po_buys
  drop constraint if exists po_buys_vat_type_chk,
  drop constraint if exists po_buys_vat_rate_percent_chk,
  drop constraint if exists po_buys_vat_amount_chk;

alter table public.po_buys
  add constraint po_buys_vat_type_chk check (vat_type in ('NONE', 'EXCLUDE')),
  add constraint po_buys_vat_rate_percent_chk check (vat_rate_percent >= 0 and vat_rate_percent <= 100),
  add constraint po_buys_vat_amount_chk check (vat_amount >= 0);
