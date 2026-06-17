alter table if exists public.customer_receipts
  drop constraint if exists customer_receipts_status_chk;

alter table if exists public.customer_receipts
  add constraint customer_receipts_status_chk
  check (status in ('pending', 'active', 'cancelled'));

alter table if exists public.customer_receipt_allocations
  drop constraint if exists customer_receipt_allocations_status_chk;

alter table if exists public.customer_receipt_allocations
  add constraint customer_receipt_allocations_status_chk
  check (status in ('pending', 'active', 'cancelled'));

alter table if exists public.customer_receipts
  drop constraint if exists customer_receipts_net_cash_chk;

alter table if exists public.customer_receipts
  add constraint customer_receipts_net_cash_chk
  check (
    status = 'pending'
    or net_cash_in = gross_amount - bank_fee_total - withholding_tax_total
  );
