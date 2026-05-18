create table if not exists public.bank_names (
  id text primary key,
  code text not null unique,
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_names_code_not_blank check (length(btrim(code)) > 0),
  constraint bank_names_name_not_blank check (length(btrim(name)) > 0)
);

create index if not exists bank_names_active_idx on public.bank_names(active);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_bank_names_updated_at' and tgrelid = 'public.bank_names'::regclass) then
    create trigger set_bank_names_updated_at
    before update on public.bank_names
    for each row execute function public.update_updated_at_column();
  end if;
end;
$$;

alter table public.bank_names enable row level security;

insert into public.bank_names (id, code, name, active)
select
  'BANK-' || lpad(row_number() over (order by bank_name)::text, 3, '0') as id,
  'BANK-' || lpad(row_number() over (order by bank_name)::text, 3, '0') as code,
  bank_name as name,
  true as active
from (
  select distinct btrim(coalesce(bank_name, bank)) as bank_name
  from public.accounts
  where coalesce(bank_name, bank) is not null
    and btrim(coalesce(bank_name, bank)) <> ''
    and btrim(coalesce(bank_name, bank)) <> '-'
) source
on conflict (name) do nothing;
