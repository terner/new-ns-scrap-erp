alter table public.petty_advances
  add column if not exists outside_loan_from_bank_name text,
  add column if not exists outside_loan_from_account_name text,
  add column if not exists outside_loan_from_account_no text,
  add column if not exists outside_loan_from_bank_branch text;
