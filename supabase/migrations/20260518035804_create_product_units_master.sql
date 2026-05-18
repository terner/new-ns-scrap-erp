create table if not exists public.product_units (
  id text primary key,
  code text not null unique,
  name text not null,
  symbol text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_units_code_not_blank check (length(btrim(code)) > 0),
  constraint product_units_name_not_blank check (length(btrim(name)) > 0)
);

create index if not exists product_units_active_idx on public.product_units(active);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_product_units_updated_at' and tgrelid = 'public.product_units'::regclass) then
    create trigger set_product_units_updated_at
    before update on public.product_units
    for each row execute function public.update_updated_at_column();
  end if;
end;
$$;

alter table public.product_units enable row level security;

insert into public.product_units (id, code, name, symbol, active)
values
  ('KG', 'KG', 'กิโลกรัม', 'กก.', true),
  ('CRATE', 'CRATE', 'ลัง', 'ลัง', true)
on conflict (id) do update
set
  code = excluded.code,
  name = excluded.name,
  symbol = excluded.symbol,
  active = excluded.active;
