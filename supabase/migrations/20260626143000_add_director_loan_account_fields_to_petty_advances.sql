alter table public.petty_advances
  add column if not exists loan_source_type text,
  add column if not exists loan_from_account_id bigint references public.accounts(id),
  add column if not exists receive_account_id bigint references public.accounts(id),
  add column if not exists loan_from_account_code_snapshot text,
  add column if not exists loan_from_account_name_snapshot text,
  add column if not exists loan_from_account_no_snapshot text,
  add column if not exists receive_account_code_snapshot text,
  add column if not exists receive_account_name_snapshot text,
  add column if not exists receive_account_no_snapshot text;

alter table public.petty_advances
  drop constraint if exists petty_advances_loan_source_type_check;

alter table public.petty_advances
  add constraint petty_advances_loan_source_type_check
  check (loan_source_type is null or loan_source_type in ('IN_SYSTEM', 'OUTSIDE_SYSTEM'));

create index if not exists idx_petty_advances_loan_from_account
  on public.petty_advances(loan_from_account_id);

create index if not exists idx_petty_advances_receive_account
  on public.petty_advances(receive_account_id);
