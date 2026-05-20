alter table public.suppliers
  add column if not exists country_code text default 'TH',
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists address_city text,
  add column if not exists address_state_region text,
  add column if not exists address_postal_code_intl text;

update public.suppliers
set
  country_code = coalesce(nullif(upper(country_code), ''), case when market_scope = 'ต่างประเทศ' then null else 'TH' end),
  address_line1 = coalesce(address_line1, nullif(trim(concat_ws(' ', address_no, nullif('หมู่ ' || address_moo, 'หมู่ '), address_village, address_road)), '')),
  address_city = coalesce(address_city, address_district),
  address_state_region = coalesce(address_state_region, address_province),
  address_postal_code_intl = coalesce(address_postal_code_intl, address_postal_code)
where market_scope <> 'ต่างประเทศ';

create index if not exists idx_suppliers_country_code on public.suppliers (country_code);
