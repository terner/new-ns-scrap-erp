alter table public.production_orders
  add column if not exists production_type text,
  add column if not exists target_lot_no text,
  add column if not exists warehouse_from_id text,
  add column if not exists warehouse_wip_id text,
  add column if not exists warehouse_to_id text,
  add column if not exists warehouse_return_id text,
  add column if not exists machine_id text,
  add column if not exists production_line_id text,
  add column if not exists shift text,
  add column if not exists supervisor_name text,
  add column if not exists operator_name text,
  add column if not exists planned_input_qty numeric default 0,
  add column if not exists planned_output_qty numeric default 0,
  add column if not exists cost_allocation_method text,
  add column if not exists normal_loss_percent numeric default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'production_orders_machine_id_fkey') then
    alter table public.production_orders
      add constraint production_orders_machine_id_fkey
      foreign key (machine_id)
      references public.production_machines(id)
      on update cascade
      on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'production_orders_production_line_id_fkey') then
    alter table public.production_orders
      add constraint production_orders_production_line_id_fkey
      foreign key (production_line_id)
      references public.production_lines(id)
      on update cascade
      on delete set null;
  end if;
end;
$$;

create index if not exists production_orders_machine_id_idx on public.production_orders(machine_id);
create index if not exists production_orders_production_line_id_idx on public.production_orders(production_line_id);
create index if not exists production_orders_status_date_idx on public.production_orders(status, date);

create table if not exists public.process_costs (
  id text primary key,
  production_order_id text not null references public.production_orders(id) on delete cascade,
  date date not null,
  cost_type text not null,
  amount numeric not null default 0,
  include_in_production boolean not null default true,
  status text not null default 'active',
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  version integer not null default 1,
  constraint process_costs_amount_non_negative check (amount >= 0),
  constraint process_costs_type_not_blank check (length(btrim(cost_type)) > 0)
);

create index if not exists process_costs_order_idx on public.process_costs(production_order_id);
create index if not exists process_costs_date_idx on public.process_costs(date);
create index if not exists process_costs_status_idx on public.process_costs(status);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_process_costs_updated_at'
      and tgrelid = 'public.process_costs'::regclass
  ) then
    create trigger set_process_costs_updated_at
    before update on public.process_costs
    for each row execute function public.update_updated_at_column();
  end if;
end;
$$;

alter table public.process_costs enable row level security;
