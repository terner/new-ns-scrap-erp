alter table public.po_buys
  add column if not exists cancel_note text,
  add column if not exists cancelled_at timestamp with time zone,
  add column if not exists cancelled_by text;

alter table public.purchase_bills
  add column if not exists cancel_note text,
  add column if not exists cancelled_at timestamp with time zone,
  add column if not exists cancelled_by text;

comment on column public.po_buys.cancel_note is 'Cancellation reason separated from document notes.';
comment on column public.po_buys.cancelled_at is 'Timestamp when the PO Buy was cancelled.';
comment on column public.po_buys.cancelled_by is 'Actor who cancelled the PO Buy.';

comment on column public.purchase_bills.cancel_note is 'Cancellation reason separated from document notes.';
comment on column public.purchase_bills.cancelled_at is 'Timestamp when the purchase bill was cancelled.';
comment on column public.purchase_bills.cancelled_by is 'Actor who cancelled the purchase bill.';
