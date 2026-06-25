alter table public.sales_bills
  add column if not exists export_order_no text;

create index if not exists idx_sales_bills_export_order_no
  on public.sales_bills(export_order_no)
  where export_order_no is not null;
