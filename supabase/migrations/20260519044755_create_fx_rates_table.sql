create table if not exists public.fx_rates (
  id text primary key,
  rate_date date not null,
  from_currency text not null,
  to_currency text not null default 'THB',
  rate_type text not null default 'BOT Rate',
  rate numeric(18, 6) not null,
  source text,
  note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  updated_by text,
  constraint fx_rates_from_currency_not_blank check (length(btrim(from_currency)) > 0),
  constraint fx_rates_to_currency_not_blank check (length(btrim(to_currency)) > 0),
  constraint fx_rates_type_not_blank check (length(btrim(rate_type)) > 0),
  constraint fx_rates_rate_positive check (rate > 0),
  constraint fx_rates_currency_pair_distinct check (upper(btrim(from_currency)) <> upper(btrim(to_currency))),
  constraint fx_rates_unique_effective unique (rate_date, from_currency, to_currency, rate_type)
);

create index if not exists fx_rates_date_idx on public.fx_rates(rate_date desc);
create index if not exists fx_rates_pair_idx on public.fx_rates(from_currency, to_currency, rate_date desc);
create index if not exists fx_rates_active_idx on public.fx_rates(active);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_fx_rates_updated_at' and tgrelid = 'public.fx_rates'::regclass) then
    create trigger set_fx_rates_updated_at
    before update on public.fx_rates
    for each row execute function public.update_updated_at_column();
  end if;
end;
$$;

alter table public.fx_rates enable row level security;

insert into public.fx_rates (id, rate_date, from_currency, to_currency, rate_type, rate, source, note)
select
  'FX-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(coalesce(nullif(symbol, ''), code)) || '-THB-BOT',
  current_date,
  upper(coalesce(nullif(symbol, ''), code)),
  'THB',
  'BOT Rate',
  rate_to_thb,
  'Current currency master',
  'Seeded from currencies.rate_to_thb for FF1 baseline'
from public.currencies
where rate_to_thb is not null
  and rate_to_thb > 0
  and upper(coalesce(nullif(symbol, ''), code)) <> 'THB'
on conflict (rate_date, from_currency, to_currency, rate_type) do nothing;
