alter table public.petty_advance_returns
  add column if not exists status text not null default 'approved',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by text,
  add column if not exists void_reason text;

update public.petty_advance_returns
set status = coalesce(nullif(status, ''), 'approved')
where status is null or btrim(status) = '';

alter table public.petty_advance_returns
  drop constraint if exists petty_advance_returns_status_check;

alter table public.petty_advance_returns
  add constraint petty_advance_returns_status_check
  check (status in ('pending', 'approved', 'voided'));

create index if not exists idx_petty_advance_returns_status
  on public.petty_advance_returns (status);

create index if not exists idx_petty_advance_returns_pending_advance
  on public.petty_advance_returns (advance_id, status)
  where status = 'pending';
