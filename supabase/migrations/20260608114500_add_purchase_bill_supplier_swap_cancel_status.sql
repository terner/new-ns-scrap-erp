begin;

alter table public.purchase_bills
  drop constraint if exists purchase_bills_status_chk;

alter table public.purchase_bills
  add constraint purchase_bills_status_chk
  check (
    status is null
    or btrim(status) = ''
    or status = any (array[
      'unpaid'::text,
      'partial'::text,
      'paid'::text,
      'cancelled'::text,
      'cancelled_supplier_swap'::text
    ])
  );

commit;
