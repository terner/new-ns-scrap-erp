drop index if exists public.idx_products_status;

alter table public.products
  drop column if exists item_status;
