alter table public.sales_bill_source_allocations
  add column if not exists weight_ticket_product_summary_id bigint;

comment on column public.sales_bill_source_allocations.weight_ticket_product_summary_id
  is 'Durable FK to the WTO product summary that supplied stock/cost for this sales line. The sales line product may differ when the customer reclassifies received goods.';

comment on column public.sales_bill_source_allocations.source_line_no
  is 'Original source document line number when the allocation is line-specific. For WTO summary allocations this is parsed from deliveryLineId, not the Sales Bill line number.';

update public.sales_bill_source_allocations sba
set weight_ticket_product_summary_id = summary.id
from public.weight_tickets wt
join public.weight_ticket_product_summaries summary
  on summary.weight_ticket_id = wt.id
where sba.source_type = 'WTO'
  and sba.weight_ticket_product_summary_id is null
  and (sba.weight_ticket_id = wt.id or sba.source_doc_no = wt.doc_no)
  and sba.product_id = summary.product_id;

update public.sales_bill_source_allocations
set source_line_no = nullif(substring(meta->>'deliveryLineId' from ':(\d+)$'), '')::integer
where source_type = 'WTO'
  and meta ? 'deliveryLineId'
  and meta->>'deliveryLineId' ~ ':\d+$';

update public.sales_bill_source_allocations
set source_line_no = null
where source_type = 'WTO'
  and not (meta ? 'deliveryLineId' and meta->>'deliveryLineId' ~ ':\d+$');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sales_bill_source_allocations_wto_summary_fkey'
      and conrelid = 'public.sales_bill_source_allocations'::regclass
  ) then
    alter table public.sales_bill_source_allocations
      add constraint sales_bill_source_allocations_wto_summary_fkey
      foreign key (weight_ticket_product_summary_id)
      references public.weight_ticket_product_summaries(id)
      on update no action
      on delete restrict
      not valid;
  end if;
end $$;

alter table public.sales_bill_source_allocations
  validate constraint sales_bill_source_allocations_wto_summary_fkey;

create index if not exists idx_sales_bill_source_allocations_wto_summary
  on public.sales_bill_source_allocations (weight_ticket_product_summary_id, status)
  where weight_ticket_product_summary_id is not null;
