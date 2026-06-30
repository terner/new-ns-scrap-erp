alter table public.weight_tickets
  drop constraint if exists weight_tickets_status_ck;

alter table public.weight_tickets
  add constraint weight_tickets_status_ck
  check (status in ('draft', 'received', 'delivered', 'partially_billed', 'billed', 'cancelled'));
