alter table public.expenses
  add column if not exists supplier_id bigint;

with normalized_suppliers as (
  select
    normalized_name,
    min(id) as supplier_id,
    count(*) as supplier_count
  from (
    select
      id,
      btrim(lower(regexp_replace(coalesce(name, ''), '\s+', ' ', 'g'))) as normalized_name
    from public.suppliers
    where active is distinct from false
  ) supplier_names
  where normalized_name <> ''
  group by normalized_name
)
update public.expenses expense
set supplier_id = normalized_suppliers.supplier_id
from normalized_suppliers
where expense.supplier_id is null
  and normalized_suppliers.supplier_count = 1
  and btrim(lower(regexp_replace(coalesce(expense.payee, ''), '\s+', ' ', 'g'))) = normalized_suppliers.normalized_name;

create index if not exists idx_expenses_supplier
  on public.expenses (supplier_id);

alter table public.expenses
  drop constraint if exists expenses_supplier_id_fkey;

alter table public.expenses
  add constraint expenses_supplier_id_fkey
  foreign key (supplier_id)
  references public.suppliers (id)
  on update no action
  on delete no action;
