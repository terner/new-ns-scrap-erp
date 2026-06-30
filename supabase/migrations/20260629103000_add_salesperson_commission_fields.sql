alter table public.salespersons
  add column if not exists commission_enabled boolean not null default false;
