create table if not exists public.account_subtypes (
  id text primary key,
  code text not null unique,
  name text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_account_subtypes_active on public.account_subtypes (active);
create index if not exists idx_account_subtypes_sort_order on public.account_subtypes (sort_order);

insert into public.account_subtypes (id, code, name, sort_order, active)
values
  ('SAVINGS', 'SAVINGS', 'ออมทรัพย์', 10, true),
  ('CURRENT', 'CURRENT', 'กระแสรายวัน', 20, true),
  ('FCD', 'FCD', 'FCD', 30, true),
  ('OD', 'OD', 'OD', 40, true)
on conflict (id) do update
set code = excluded.code,
    name = excluded.name,
    sort_order = excluded.sort_order,
    active = excluded.active;
