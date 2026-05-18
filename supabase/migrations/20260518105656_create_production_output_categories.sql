create table if not exists public.production_output_categories (
  id text primary key,
  code text not null unique,
  name_th text not null,
  name_en text,
  stock_effect text not null default 'stock_in',
  available_for_sale boolean not null default true,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_output_categories_code_not_blank check (length(btrim(code)) > 0),
  constraint production_output_categories_name_not_blank check (length(btrim(name_th)) > 0),
  constraint production_output_categories_code_shape check (code ~ '^[A-Z0-9_]+$'),
  constraint production_output_categories_stock_effect_check check (stock_effect in ('stock_in', 'return_stock_in', 'loss'))
);

create index if not exists production_output_categories_active_idx
  on public.production_output_categories(active);

create index if not exists production_output_categories_sort_idx
  on public.production_output_categories(sort_order, code);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_production_output_categories_updated_at'
      and tgrelid = 'public.production_output_categories'::regclass
  ) then
    create trigger set_production_output_categories_updated_at
    before update on public.production_output_categories
    for each row execute function public.update_updated_at_column();
  end if;
end;
$$;

alter table public.production_output_categories enable row level security;

insert into public.production_output_categories
  (id, code, name_th, name_en, stock_effect, available_for_sale, sort_order, active)
values
  ('POC001', 'FG', 'สินค้าสำเร็จรูป', 'Finished Goods', 'stock_in', true, 10, true),
  ('POC002', 'RM', 'วัตถุดิบที่ได้กลับมา', 'Recovered Raw Material', 'stock_in', true, 20, true),
  ('POC003', 'CUSTOMER_RETURN', 'ของคืนลูกค้า', 'Customer Return', 'return_stock_in', false, 30, true),
  ('POC004', 'LOSS', 'สูญเสีย / ของเสีย', 'Loss / Waste', 'loss', false, 40, true)
on conflict (code) do update
set
  name_th = excluded.name_th,
  name_en = excluded.name_en,
  stock_effect = excluded.stock_effect,
  available_for_sale = excluded.available_for_sale,
  sort_order = excluded.sort_order,
  active = excluded.active;

alter table public.production_outputs
  add column if not exists output_category text,
  add column if not exists output_status text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'production_outputs_output_category_fkey'
  ) then
    alter table public.production_outputs
      add constraint production_outputs_output_category_fkey
      foreign key (output_category)
      references public.production_output_categories(code)
      on update cascade
      on delete restrict;
  end if;
end;
$$;

create index if not exists production_outputs_output_category_idx
  on public.production_outputs(output_category);
