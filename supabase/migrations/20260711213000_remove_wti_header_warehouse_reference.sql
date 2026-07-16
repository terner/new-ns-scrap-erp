drop view if exists public.weight_ticket_warehouse_migration_issues;

alter table public.weight_tickets
  drop constraint if exists weight_tickets_header_warehouse_shape_check,
  drop constraint if exists weight_tickets_warehouse_id_fkey;

drop index if exists public.idx_weight_tickets_warehouse_id;

alter table public.weight_tickets
  drop column if exists warehouse_id;

comment on column public.weight_tickets.warehouse_name is
  'WTI physical godown name snapshot. This is not a stock warehouse dimension; WTO stock warehouse remains line-level.';
