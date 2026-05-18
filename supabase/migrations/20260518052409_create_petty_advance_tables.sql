create table if not exists public.petty_advances (
  id text primary key,
  doc_no text not null unique,
  date date not null,
  type text not null default 'DIRECTOR_LOAN',
  recipient_name text not null,
  amount numeric not null default 0,
  account_id text references public.accounts(id),
  status text not null default 'active',
  notes text,
  returned_amount numeric not null default 0,
  closed_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint petty_advances_type_check check (type in ('DIRECTOR_LOAN', 'PETTY_CASH')),
  constraint petty_advances_status_check check (status in ('active', 'closed', 'cancelled')),
  constraint petty_advances_amount_check check (amount >= 0),
  constraint petty_advances_returned_amount_check check (returned_amount >= 0)
);

create index if not exists idx_petty_advances_date on public.petty_advances(date desc);
create index if not exists idx_petty_advances_account on public.petty_advances(account_id);
create index if not exists idx_petty_advances_status on public.petty_advances(status);
create index if not exists idx_petty_advances_type on public.petty_advances(type);

create table if not exists public.petty_advance_returns (
  id text primary key,
  advance_id text not null references public.petty_advances(id) on delete restrict,
  date date not null,
  amount numeric not null default 0,
  account_id text references public.accounts(id),
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  constraint petty_advance_returns_amount_check check (amount > 0)
);

create index if not exists idx_petty_advance_returns_advance on public.petty_advance_returns(advance_id);
create index if not exists idx_petty_advance_returns_date on public.petty_advance_returns(date desc);
create index if not exists idx_petty_advance_returns_account on public.petty_advance_returns(account_id);

alter table public.petty_advances enable row level security;
alter table public.petty_advance_returns enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'petty_advances'
      and policyname = 'authenticated can read petty advances'
  ) then
    create policy "authenticated can read petty advances"
      on public.petty_advances
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'petty_advances'
      and policyname = 'authenticated can write petty advances'
  ) then
    create policy "authenticated can write petty advances"
      on public.petty_advances
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'petty_advance_returns'
      and policyname = 'authenticated can read petty advance returns'
  ) then
    create policy "authenticated can read petty advance returns"
      on public.petty_advance_returns
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'petty_advance_returns'
      and policyname = 'authenticated can write petty advance returns'
  ) then
    create policy "authenticated can write petty advance returns"
      on public.petty_advance_returns
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;
