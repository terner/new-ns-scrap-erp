create table if not exists public.production_machine_types (
  id text primary key,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_production_machine_types_active
  on public.production_machine_types (active);
insert into public.production_machine_types (id, name, active)
select
  'MT-' || lpad(row_number() over (order by type)::text, 3, '0') as id,
  type as name,
  true as active
from (
  select distinct trim(type) as type
  from public.production_machines
  where nullif(trim(type), '') is not null
) source
on conflict (name) do update
set active = excluded.active,
    updated_at = now();
insert into public.production_machine_types (id, name, active)
values
  ('MT-SORTING', 'Sorting', true),
  ('MT-CUTTING', 'Cutting', true),
  ('MT-BALING', 'Baling', true),
  ('MT-CRUSHING', 'Crushing', true),
  ('MT-MELTING', 'Melting', true),
  ('MT-OTHER', 'Other', true)
on conflict (name) do update
set active = excluded.active,
    updated_at = now();
