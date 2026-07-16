alter table public.customer_advances
  add column branch_id bigint;

update public.customer_advances ca
set branch_id = cb.branch_id
from public.customer_branches cb
where cb.customer_id = ca.customer_id
  and cb.active is true
  and cb.is_primary is true
  and ca.branch_id is null;

do $$
begin
  if exists (select 1 from public.customer_advances where branch_id is null) then
    raise exception 'customer_advances.branch_id cannot be derived from primary customer branch';
  end if;
end $$;

alter table public.customer_advances
  alter column branch_id set not null,
  add constraint customer_advances_branch_id_fkey
    foreign key (branch_id) references public.branches(id) on delete restrict on update no action;

create index idx_customer_advances_branch_date
  on public.customer_advances (branch_id, document_date desc, doc_no desc);

do $$
begin
  if exists (
    select 1
    from public.customer_advances ca
    join public.branches b on b.id = ca.branch_id
    where regexp_replace(b.code, '\D', '', 'g') !~ '^\d{1,2}$'
  ) then
    raise exception 'customer_advances branch code must contain 1-2 digits for CADV numbering';
  end if;
end $$;

with numbered as (
  select
    ca.id,
    'CADV'
        || lpad(regexp_replace(b.code, '\D', '', 'g'), 2, '0')
        || to_char(ca.document_date, 'YYMM')
        || '-'
      || lpad(row_number() over (
        partition by ca.branch_id, to_char(ca.document_date, 'YYMM')
        order by ca.created_at, ca.id
      )::text, 4, '0') as next_doc_no
  from public.customer_advances ca
  join public.branches b on b.id = ca.branch_id
)
update public.customer_advances ca
set doc_no = numbered.next_doc_no
from numbered
where numbered.id = ca.id
  and ca.doc_no <> numbered.next_doc_no;
