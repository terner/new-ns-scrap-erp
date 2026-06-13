-- Optimize Stock Count Adjust list/filter/correction lookups.
-- The page reads stock_adjustments as the adjustment header/audit source and
-- stock_ledger ADJ/ADJ-REV rows as append-only stock movement evidence.

create unique index if not exists uq_stock_adjustments_doc_no
  on public.stock_adjustments (doc_no)
  where doc_no is not null;

create index if not exists idx_stock_adjustments_doc_no_pattern
  on public.stock_adjustments (doc_no text_pattern_ops)
  where doc_no is not null;

create index if not exists idx_stock_adjustments_list_date_created
  on public.stock_adjustments (date desc, created_at desc, id desc);

create index if not exists idx_stock_adjustments_branch_date_created
  on public.stock_adjustments (branch_id, date desc, created_at desc, id desc)
  where branch_id is not null;

create index if not exists idx_stock_adjustments_product_date_created
  on public.stock_adjustments (product_id, date desc, created_at desc, id desc)
  where product_id is not null;

create index if not exists idx_stock_adjustments_type_date_created
  on public.stock_adjustments (adjust_type, date desc, created_at desc, id desc)
  where adjust_type is not null;

create index if not exists idx_stock_ledger_adj_ref_lookup
  on public.stock_ledger (ref_type, ref_no, created_at desc, id desc)
  where ref_type in ('ADJ', 'ADJ-REV');
