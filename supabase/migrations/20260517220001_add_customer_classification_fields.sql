-- Customer classification cleanup for Next.js master-data filters.
-- Additive/non-destructive: no customer rows are deleted.

update public.customers
set type = null
where type is not null
  and btrim(type) = '';
update public.customers
set type = case
  when type in ('บริษัท', 'นิติบุคคล', '法人') then 'นิติบุคคล'
  when type in ('บุคคล', 'บุคคลธรรมดา', 'ส่วนบุคคล') then 'บุคคล'
  when type = 'ต่างประเทศ' then null
  else type
end
where type is not null;
update public.customers
set type = case
  when name ~* '(บริษัท|บจก\.?|บจ\.?|จำกัด|หจก\.?|ห้างหุ้นส่วน|corporation|co\.?[, ]*ltd|company|limited|ltd\.?|dmcc)' then 'นิติบุคคล'
  else 'บุคคล'
end
where type is null
   or btrim(type) = '';
alter table public.customers
  add column if not exists market_scope text not null default 'ในประเทศ';
comment on column public.customers.type is 'Customer legal type: บุคคล or นิติบุคคล.';
comment on column public.customers.market_scope is 'Customer market scope: ในประเทศ or ต่างประเทศ.';
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_type_allowed_chk'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_type_allowed_chk
      check (type is null or type in ('บุคคล', 'นิติบุคคล'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_market_scope_allowed_chk'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_market_scope_allowed_chk
      check (market_scope in ('ในประเทศ', 'ต่างประเทศ'));
  end if;
end $$;
create index if not exists idx_customers_type on public.customers(type);
create index if not exists idx_customers_market_scope on public.customers(market_scope);
create index if not exists idx_customers_active on public.customers(active);
