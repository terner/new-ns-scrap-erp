begin;

update public.expenses
set
  status = 'pending_approval',
  updated_at = coalesce(updated_at, now())
where status is null
  or btrim(status) = ''
  or status = 'pending';

alter table public.expenses
  alter column status set default 'pending_approval',
  alter column status set not null;

alter table public.expenses
  drop constraint if exists expenses_status_chk;

alter table public.expenses
  add constraint expenses_status_chk
  check (status in ('pending_approval', 'approved', 'paid', 'cancelled'));

commit;
