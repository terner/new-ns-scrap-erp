alter table public.payment_methods
  add column if not exists type text;

update public.payment_methods
set type = case
  when lower(coalesce(name, '')) like '%cash%' or name like '%เงินสด%' then 'cash'
  else 'bank'
end
where type is null;

alter table public.payment_methods
  alter column type set default 'bank';

update public.payment_methods
set type = 'bank'
where coalesce(type, '') not in ('cash', 'bank');

alter table public.payment_methods
  alter column type set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_methods_type_check'
      and conrelid = 'public.payment_methods'::regclass
  ) then
    alter table public.payment_methods
      add constraint payment_methods_type_check
      check (type in ('cash', 'bank'));
  end if;
end $$;

create index if not exists payment_methods_type_idx on public.payment_methods(type);
