alter table public.weight_tickets
  add column warehouse_id bigint;

alter table public.weight_tickets
  add constraint weight_tickets_warehouse_id_fkey
    foreign key (warehouse_id)
    references public.warehouses (id)
    on delete restrict;

create index idx_weight_tickets_warehouse_id
  on public.weight_tickets (warehouse_id)
  where warehouse_id is not null;

alter table public.weight_tickets
  add constraint weight_tickets_header_warehouse_shape_check check (
    (doc_type = 'WTI' and warehouse_id is not null)
    or
    (doc_type = 'WTO' and warehouse_id is null)
  ) not valid;

comment on column public.weight_tickets.warehouse_id is
  'Required master warehouse for new/edited WTI documents. WTO warehouse remains line-level.';

create or replace view public.weight_ticket_warehouse_migration_issues as
select
  ticket.id as weight_ticket_id,
  ticket.doc_no,
  ticket.branch_id,
  ticket.warehouse_name as legacy_warehouse_name,
  'WTI_HEADER_WAREHOUSE_UNRESOLVED'::text as issue_code
from public.weight_tickets ticket
where ticket.doc_type = 'WTI'
  and ticket.warehouse_id is null;

comment on view public.weight_ticket_warehouse_migration_issues is
  'Legacy WTI rows whose free-text warehouse has not been explicitly mapped to warehouse master data.';
