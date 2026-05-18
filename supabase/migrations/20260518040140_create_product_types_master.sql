create table if not exists public.product_types (
  id text primary key,
  code text not null unique,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_types_code_not_blank check (length(btrim(code)) > 0),
  constraint product_types_name_not_blank check (length(btrim(name)) > 0)
);

create index if not exists product_types_active_idx on public.product_types(active);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_product_types_updated_at' and tgrelid = 'public.product_types'::regclass) then
    create trigger set_product_types_updated_at
    before update on public.product_types
    for each row execute function public.update_updated_at_column();
  end if;
end;
$$;

alter table public.product_types enable row level security;

insert into public.product_types (id, code, name, active)
values ('PT-ELECTRONICS', 'PT-ELECTRONICS', 'อิเล็กทรอนิกส์', true)
on conflict (name) do update
set
  code = excluded.code,
  active = excluded.active;

insert into public.product_types (id, code, name, active)
select
  'PT-' || lpad(row_number() over (order by btrim(type))::text, 3, '0') as id,
  'PT-' || lpad(row_number() over (order by btrim(type))::text, 3, '0') as code,
  btrim(type) as name,
  true as active
from (
  select distinct type
  from public.products
  where type is not null
    and btrim(type) <> ''
) source
on conflict (name) do nothing;
