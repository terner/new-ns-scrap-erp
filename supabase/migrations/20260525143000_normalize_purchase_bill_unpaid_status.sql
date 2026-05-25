-- Normalize purchase bill unpaid status to a single canonical value.
update public.purchase_bills
set status = 'unpaid'
where lower(coalesce(status, '')) = 'open';

alter table public.purchase_bills
  alter column status set default 'unpaid';

alter table public.purchase_bills
  drop constraint if exists purchase_bills_status_chk;

alter table public.purchase_bills
  add constraint purchase_bills_status_chk
  check (
    status is null
    or status = any (array['unpaid'::text, 'partial'::text, 'paid'::text, 'cancelled'::text])
  );
