alter table public.weight_tickets
  alter column gross_weight type numeric(18,2) using round(gross_weight, 2),
  alter column deduct_weight type numeric(18,2) using round(deduct_weight, 2),
  alter column net_weight type numeric(18,2) using round(net_weight, 2),
  alter column container_deduction_weight type numeric(18,2) using round(container_deduction_weight, 2);

alter table public.weight_ticket_lines
  alter column gross_weight type numeric(18,2) using round(gross_weight, 2),
  alter column deduct_weight type numeric(18,2) using round(deduct_weight, 2),
  alter column net_weight type numeric(18,2) using round(net_weight, 2),
  alter column deduction_value type numeric(18,2) using round(deduction_value, 2),
  alter column container_deduction_weight type numeric(18,2) using round(container_deduction_weight, 2);

alter table public.weight_ticket_product_summaries
  alter column gross_weight type numeric(18,2) using round(gross_weight, 2),
  alter column deduct_weight type numeric(18,2) using round(deduct_weight, 2),
  alter column net_weight type numeric(18,2) using round(net_weight, 2),
  alter column billed_weight type numeric(18,2) using round(billed_weight, 2),
  alter column remaining_weight type numeric(18,2) using round(remaining_weight, 2),
  alter column container_deduction_weight type numeric(18,2) using round(container_deduction_weight, 2);

alter table public.weight_ticket_status_logs
  alter column gross_weight_snapshot type numeric(18,2) using round(gross_weight_snapshot, 2),
  alter column deduct_weight_snapshot type numeric(18,2) using round(deduct_weight_snapshot, 2),
  alter column net_weight_snapshot type numeric(18,2) using round(net_weight_snapshot, 2);

alter table public.weight_ticket_usage_logs
  alter column allocated_qty type numeric(18,2) using round(allocated_qty, 2),
  alter column allocated_gross_weight type numeric(18,2) using round(allocated_gross_weight, 2),
  alter column allocated_deduct_weight type numeric(18,2) using round(allocated_deduct_weight, 2),
  alter column allocated_net_weight type numeric(18,2) using round(allocated_net_weight, 2),
  alter column from_remaining_weight type numeric(18,2) using round(from_remaining_weight, 2),
  alter column to_remaining_weight type numeric(18,2) using round(to_remaining_weight, 2);

alter table public.weight_ticket_pending_out_events
  alter column qty type numeric(18,2) using round(qty, 2),
  alter column qty_before type numeric(18,2) using round(qty_before, 2),
  alter column qty_after type numeric(18,2) using round(qty_after, 2);

alter table public.stock_holds
  alter column qty type numeric(18,2) using round(qty, 2);

alter table public.purchase_bill_receipt_allocations
  alter column allocated_qty type numeric(18,2) using round(allocated_qty, 2),
  alter column allocated_gross_weight type numeric(18,2) using round(allocated_gross_weight, 2),
  alter column allocated_deduct_weight type numeric(18,2) using round(allocated_deduct_weight, 2);

alter table public.sales_bill_source_allocations
  alter column allocated_qty type numeric(18,2) using round(allocated_qty, 2),
  alter column allocated_gross_weight type numeric(18,2) using round(allocated_gross_weight, 2),
  alter column allocated_deduct_weight type numeric(18,2) using round(allocated_deduct_weight, 2),
  alter column allocated_net_weight type numeric(18,2) using round(allocated_net_weight, 2);

alter table public.weight_tickets
  add constraint weight_tickets_type_status_check check (
    (doc_type = 'WTI' and status in ('draft', 'received', 'partially_billed', 'billed', 'cancelled'))
    or
    (doc_type = 'WTO' and status in ('draft', 'delivered', 'partially_billed', 'billed', 'cancelled'))
  ),
  add constraint weight_tickets_party_shape_check check (
    (doc_type = 'WTI' and supplier_id is not null and customer_id is null)
    or
    (doc_type = 'WTO' and customer_id is not null and supplier_id is null)
  ),
  add constraint weight_tickets_weights_nonnegative_check check (
    gross_weight >= 0 and deduct_weight >= 0 and net_weight >= 0 and container_deduction_weight >= 0
  );

alter table public.weight_ticket_lines
  add constraint weight_ticket_lines_weights_nonnegative_check check (
    gross_weight >= 0 and deduct_weight >= 0 and net_weight >= 0
    and deduction_value >= 0 and container_deduction_weight >= 0
  ),
  add constraint weight_ticket_lines_parent_line_fkey
    foreign key (weight_ticket_id, parent_line_no)
    references public.weight_ticket_lines (weight_ticket_id, line_no)
    on delete cascade
    deferrable initially deferred,
  add constraint weight_ticket_lines_impurity_source_line_fkey
    foreign key (weight_ticket_id, impurity_source_line_no)
    references public.weight_ticket_lines (weight_ticket_id, line_no)
    on delete cascade
    deferrable initially deferred;

alter table public.weight_ticket_product_summaries
  add constraint weight_ticket_product_summaries_weights_nonnegative_check check (
    gross_weight >= 0 and deduct_weight >= 0 and net_weight >= 0
    and billed_weight >= 0 and remaining_weight >= 0 and container_deduction_weight >= 0
  );

alter table public.stock_holds
  add constraint stock_holds_qty_positive_check check (qty > 0);

create or replace view public.weight_ticket_reconciliation_issues as
with summary_totals as (
  select
    weight_ticket_id,
    coalesce(sum(gross_weight), 0)::numeric(18,2) as gross_weight,
    coalesce(sum(container_deduction_weight), 0)::numeric(18,2) as container_deduction_weight,
    coalesce(sum(deduct_weight), 0)::numeric(18,2) as deduct_weight,
    coalesce(sum(net_weight), 0)::numeric(18,2) as net_weight
  from public.weight_ticket_product_summaries
  group by weight_ticket_id
), summary_line_counts as (
  select
    summary.id as summary_id,
    summary.weight_ticket_id,
    summary.line_count,
    count(bridge.weight_ticket_line_id)::integer as bridged_line_count
  from public.weight_ticket_product_summaries summary
  left join public.weight_ticket_product_summary_lines bridge on bridge.summary_id = summary.id
  group by summary.id, summary.weight_ticket_id, summary.line_count
)
select
  ticket.id as weight_ticket_id,
  ticket.doc_no,
  'HEADER_SUMMARY_WEIGHT_MISMATCH'::text as issue_code,
  jsonb_build_object(
    'header', jsonb_build_object(
      'grossWeight', ticket.gross_weight,
      'containerDeductionWeight', ticket.container_deduction_weight,
      'deductWeight', ticket.deduct_weight,
      'netWeight', ticket.net_weight
    ),
    'summary', jsonb_build_object(
      'grossWeight', coalesce(total.gross_weight, 0),
      'containerDeductionWeight', coalesce(total.container_deduction_weight, 0),
      'deductWeight', coalesce(total.deduct_weight, 0),
      'netWeight', coalesce(total.net_weight, 0)
    )
  ) as detail
from public.weight_tickets ticket
left join summary_totals total on total.weight_ticket_id = ticket.id
where ticket.gross_weight <> coalesce(total.gross_weight, 0)
   or ticket.container_deduction_weight <> coalesce(total.container_deduction_weight, 0)
   or ticket.deduct_weight <> coalesce(total.deduct_weight, 0)
   or ticket.net_weight <> coalesce(total.net_weight, 0)
union all
select
  ticket.id as weight_ticket_id,
  ticket.doc_no,
  'SUMMARY_LINE_COUNT_MISMATCH'::text as issue_code,
  jsonb_build_object(
    'summaryId', counts.summary_id,
    'lineCount', counts.line_count,
    'bridgedLineCount', counts.bridged_line_count
  ) as detail
from summary_line_counts counts
join public.weight_tickets ticket on ticket.id = counts.weight_ticket_id
where counts.line_count <> counts.bridged_line_count;

comment on view public.weight_ticket_reconciliation_issues is
  'Reports WTI/WTO header-to-summary weight drift and summary-to-line bridge count drift.';
