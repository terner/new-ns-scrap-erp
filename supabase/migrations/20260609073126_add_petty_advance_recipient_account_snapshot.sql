alter table public.petty_advances
  add column if not exists recipient_person_code text,
  add column if not exists recipient_bank_name text,
  add column if not exists recipient_bank_account_name text,
  add column if not exists recipient_account_no text,
  add column if not exists recipient_bank_branch text;

create index if not exists idx_petty_advances_recipient_person_code
  on public.petty_advances (recipient_person_code);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'petty_advances_recipient_person_code_fkey'
      and conrelid = 'public.petty_advances'::regclass
  ) then
    alter table public.petty_advances
      add constraint petty_advances_recipient_person_code_fkey
      foreign key (recipient_person_code)
      references public.director_employees(code)
      on update no action
      on delete no action;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'petty_advances_recipient_account_no_chk'
      and conrelid = 'public.petty_advances'::regclass
  ) then
    alter table public.petty_advances
      add constraint petty_advances_recipient_account_no_chk
      check (recipient_account_no is null or recipient_account_no ~ '^[0-9]+$');
  end if;
end $$;
