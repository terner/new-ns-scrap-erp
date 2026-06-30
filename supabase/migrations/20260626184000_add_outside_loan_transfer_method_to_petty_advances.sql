alter table public.petty_advances
  add column if not exists outside_loan_transfer_method text;

alter table public.petty_advances
  drop constraint if exists petty_advances_outside_loan_transfer_method_check;

alter table public.petty_advances
  add constraint petty_advances_outside_loan_transfer_method_check
  check (
    outside_loan_transfer_method is null
    or outside_loan_transfer_method in ('COUNTER_DEPOSIT', 'BANK_TRANSFER')
  );
