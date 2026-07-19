begin;

alter table public.sales_bill_lines
  add column if not exists cogs_amount numeric(18,2),
  add column if not exists gross_profit numeric(18,2);

alter table public.sales_bill_lines
  drop constraint if exists sales_bill_lines_profit_equation_check;

alter table public.sales_bill_lines
  add constraint sales_bill_lines_profit_equation_check
  check (
    gross_profit is null
    or (
      cogs_amount is not null
      and gross_profit = round(line_amount - cogs_amount, 2)
    )
  );

alter table public.purchase_bills
  add column if not exists purchase_channel_id bigint;

create unique index if not exists uq_purchase_channels_code
  on public.purchase_channels (upper(code));

insert into public.purchase_channels (code, name, active)
select distinct upper(trim(pb.purchase_source)), trim(pb.purchase_source), true
from public.purchase_bills pb
where nullif(trim(pb.purchase_source), '') is not null
  and not exists (
    select 1 from public.purchase_channels channel
    where upper(channel.code) = upper(trim(pb.purchase_source))
  );

update public.purchase_bills pb
set purchase_channel_id = channel.id
from public.purchase_channels channel
where pb.purchase_channel_id is null
  and nullif(trim(pb.purchase_source), '') is not null
  and upper(channel.code) = upper(trim(pb.purchase_source));

alter table public.purchase_bills
  drop constraint if exists purchase_bills_purchase_channel_id_fkey;

alter table public.purchase_bills
  add constraint purchase_bills_purchase_channel_id_fkey
  foreign key (purchase_channel_id)
  references public.purchase_channels(id)
  on update no action
  on delete restrict;

create index if not exists idx_purchase_bills_purchase_channel_created_doc_no
  on public.purchase_bills (purchase_channel_id, created_at desc, doc_no desc)
  where purchase_channel_id is not null;

create table if not exists public.report_profit_cost_facts (
  id bigint generated always as identity primary key,
  source_type text not null,
  source_doc_no text not null,
  source_line_no integer not null,
  source_event_key text not null,
  event_date date not null,
  branch_id bigint not null references public.branches(id) on update no action on delete restrict,
  product_id bigint not null references public.products(id) on update no action on delete restrict,
  supplier_id bigint references public.suppliers(id) on update no action on delete restrict,
  customer_id bigint references public.customers(id) on update no action on delete restrict,
  purchase_channel_id bigint references public.purchase_channels(id) on update no action on delete restrict,
  sales_channel_id bigint references public.sales_channels(id) on update no action on delete restrict,
  fact_type text not null,
  quantity numeric(18,3) not null default 0,
  purchase_amount numeric(18,2) not null default 0,
  revenue_amount numeric(18,2) not null default 0,
  cogs_amount numeric(18,2) not null default 0,
  stock_quantity_delta numeric(18,3) not null default 0,
  stock_value_delta numeric(18,2) not null default 0,
  projected_at timestamptz not null default now(),
  source_updated_at timestamptz not null,
  constraint report_profit_cost_facts_source_key_unique
    unique (source_type, source_doc_no, source_line_no, source_event_key, fact_type),
  constraint report_profit_cost_facts_source_type_check
    check (source_type in ('PURCHASE_BILL', 'SALES_BILL', 'STOCK_LEDGER')),
  constraint report_profit_cost_facts_fact_type_check
    check (fact_type in ('PURCHASE', 'SALE', 'STOCK', 'CANCELLATION_TRACE')),
  constraint report_profit_cost_facts_dimension_shape_check check (
    (fact_type = 'PURCHASE' and supplier_id is not null and purchase_channel_id is not null and customer_id is null and sales_channel_id is null)
    or (fact_type = 'SALE' and customer_id is not null and sales_channel_id is not null and supplier_id is null and purchase_channel_id is null)
    or (fact_type = 'STOCK' and supplier_id is null and customer_id is null)
    or (fact_type = 'CANCELLATION_TRACE')
  )
);

create index if not exists idx_report_profit_cost_facts_date_branch_product
  on public.report_profit_cost_facts (event_date, branch_id, product_id);
create index if not exists idx_report_profit_cost_facts_source
  on public.report_profit_cost_facts (source_type, source_doc_no);
create index if not exists idx_report_profit_cost_facts_supplier_date
  on public.report_profit_cost_facts (supplier_id, event_date) where supplier_id is not null;
create index if not exists idx_report_profit_cost_facts_customer_date
  on public.report_profit_cost_facts (customer_id, event_date) where customer_id is not null;
create index if not exists idx_report_profit_cost_facts_purchase_channel_date
  on public.report_profit_cost_facts (purchase_channel_id, event_date) where purchase_channel_id is not null;
create index if not exists idx_report_profit_cost_facts_sales_channel_date
  on public.report_profit_cost_facts (sales_channel_id, event_date) where sales_channel_id is not null;

create table if not exists public.report_profit_cost_daily (
  id bigint generated always as identity primary key,
  event_date date not null,
  branch_id bigint not null references public.branches(id) on update no action on delete restrict,
  product_id bigint not null references public.products(id) on update no action on delete restrict,
  supplier_id bigint references public.suppliers(id) on update no action on delete restrict,
  customer_id bigint references public.customers(id) on update no action on delete restrict,
  purchase_channel_id bigint references public.purchase_channels(id) on update no action on delete restrict,
  sales_channel_id bigint references public.sales_channels(id) on update no action on delete restrict,
  quantity numeric(18,3) not null default 0,
  purchase_amount numeric(18,2) not null default 0,
  revenue_amount numeric(18,2) not null default 0,
  cogs_amount numeric(18,2) not null default 0,
  stock_quantity_delta numeric(18,3) not null default 0,
  stock_value_delta numeric(18,2) not null default 0,
  refreshed_at timestamptz not null default now(),
  constraint report_profit_cost_daily_dimension_unique
    unique nulls not distinct (
      event_date, branch_id, product_id, supplier_id, customer_id,
      purchase_channel_id, sales_channel_id
    )
);

create index if not exists idx_report_profit_cost_daily_date_branch
  on public.report_profit_cost_daily (event_date, branch_id);
create index if not exists idx_report_profit_cost_daily_product_date
  on public.report_profit_cost_daily (product_id, event_date);
create index if not exists idx_report_profit_cost_daily_supplier_date
  on public.report_profit_cost_daily (supplier_id, event_date) where supplier_id is not null;
create index if not exists idx_report_profit_cost_daily_customer_date
  on public.report_profit_cost_daily (customer_id, event_date) where customer_id is not null;

create or replace function public.rebuild_profit_cost_daily(p_from date, p_to date)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'INVALID_PROFIT_COST_REBUILD_RANGE';
  end if;

  delete from public.report_profit_cost_daily
  where event_date between p_from and p_to;

  insert into public.report_profit_cost_daily (
    event_date, branch_id, product_id, supplier_id, customer_id,
    purchase_channel_id, sales_channel_id, quantity, purchase_amount,
    revenue_amount, cogs_amount, stock_quantity_delta, stock_value_delta,
    refreshed_at
  )
  select
    event_date, branch_id, product_id, supplier_id, customer_id,
    purchase_channel_id, sales_channel_id,
    sum(quantity), sum(purchase_amount), sum(revenue_amount), sum(cogs_amount),
    sum(stock_quantity_delta), sum(stock_value_delta), now()
  from public.report_profit_cost_facts
  where event_date between p_from and p_to
  group by event_date, branch_id, product_id, supplier_id, customer_id,
    purchase_channel_id, sales_channel_id;
end;
$$;

create or replace function public.project_profit_cost_purchase_bill(p_purchase_bill_id bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bill public.purchase_bills%rowtype;
  v_old_min_date date;
  v_old_max_date date;
begin
  select * into v_bill from public.purchase_bills where id = p_purchase_bill_id for update;
  if not found then raise exception 'PURCHASE_BILL_NOT_FOUND: %', p_purchase_bill_id; end if;

  select min(event_date), max(event_date) into v_old_min_date, v_old_max_date
  from public.report_profit_cost_facts
  where source_type = 'PURCHASE_BILL' and source_doc_no = v_bill.doc_no;
  delete from public.report_profit_cost_facts
  where source_type = 'PURCHASE_BILL' and source_doc_no = v_bill.doc_no;

  if lower(coalesce(v_bill.status, '')) in ('cancelled', 'canceled', 'void', 'voided', 'reversed') then
    insert into public.report_profit_cost_facts (
      source_type, source_doc_no, source_line_no, source_event_key, event_date,
      branch_id, product_id, fact_type, source_updated_at
    )
    select 'PURCHASE_BILL', v_bill.doc_no, item.line_no, 'CURRENT', v_bill.created_at::date,
      v_bill.branch_id, item.product_id, 'CANCELLATION_TRACE', coalesce(v_bill.updated_at, v_bill.created_at)
    from public.purchase_bill_items item
    where item.purchase_bill_id = v_bill.id and item.item_status = 'active'
      and v_bill.branch_id is not null and item.product_id is not null;
  elsif lower(coalesce(v_bill.status, '')) <> 'draft' then
    if v_bill.branch_id is null then raise exception 'MISSING_BRANCH_ID: %', v_bill.doc_no; end if;
    if v_bill.supplier_id is null then raise exception 'MISSING_SUPPLIER_ID: %', v_bill.doc_no; end if;
    if v_bill.purchase_channel_id is null then raise exception 'MISSING_PURCHASE_CHANNEL_ID: %', v_bill.doc_no; end if;

    insert into public.report_profit_cost_facts (
      source_type, source_doc_no, source_line_no, source_event_key, event_date,
      branch_id, product_id, supplier_id, purchase_channel_id, fact_type,
      quantity, purchase_amount, source_updated_at
    )
    select 'PURCHASE_BILL', v_bill.doc_no, item.line_no, 'CURRENT', v_bill.created_at::date,
      v_bill.branch_id, item.product_id, v_bill.supplier_id, v_bill.purchase_channel_id,
      'PURCHASE', round(item.qty, 3), round(item.amount, 2), coalesce(v_bill.updated_at, v_bill.created_at)
    from public.purchase_bill_items item
    where item.purchase_bill_id = v_bill.id and item.item_status = 'active'
      and item.product_id is not null;

    if exists (
      select 1 from public.purchase_bill_items item
      where item.purchase_bill_id = v_bill.id and item.item_status = 'active' and item.product_id is null
    ) then raise exception 'MISSING_PRODUCT_ID: %', v_bill.doc_no; end if;
  end if;

  perform public.rebuild_profit_cost_daily(
    least(coalesce(v_old_min_date, v_bill.created_at::date), v_bill.created_at::date),
    greatest(coalesce(v_old_max_date, v_bill.created_at::date), v_bill.created_at::date)
  );
end;
$$;

create or replace function public.project_profit_cost_sales_bill(p_sales_bill_id bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bill public.sales_bills%rowtype;
  v_old_min_date date;
  v_old_max_date date;
begin
  select * into v_bill from public.sales_bills where id = p_sales_bill_id for update;
  if not found then raise exception 'SALES_BILL_NOT_FOUND: %', p_sales_bill_id; end if;

  select min(event_date), max(event_date) into v_old_min_date, v_old_max_date
  from public.report_profit_cost_facts
  where source_type = 'SALES_BILL' and source_doc_no = v_bill.doc_no;
  delete from public.report_profit_cost_facts
  where source_type = 'SALES_BILL' and source_doc_no = v_bill.doc_no;

  if lower(coalesce(v_bill.status, '')) in ('cancelled', 'canceled', 'void', 'voided', 'reversed') then
    insert into public.report_profit_cost_facts (
      source_type, source_doc_no, source_line_no, source_event_key, event_date,
      branch_id, product_id, fact_type, source_updated_at
    )
    select 'SALES_BILL', v_bill.doc_no, line.line_no, 'CURRENT', v_bill.date,
      v_bill.branch_id, line.product_id, 'CANCELLATION_TRACE', coalesce(v_bill.updated_at, v_bill.created_at, now())
    from public.sales_bill_lines line
    where line.sales_bill_id = v_bill.id and line.status = 'active'
      and v_bill.branch_id is not null and line.product_id is not null;
  elsif lower(coalesce(v_bill.status, '')) <> 'draft' then
    if v_bill.branch_id is null then raise exception 'MISSING_BRANCH_ID: %', v_bill.doc_no; end if;
    if v_bill.customer_id is null then raise exception 'MISSING_CUSTOMER_ID: %', v_bill.doc_no; end if;
    if v_bill.channel_id is null then raise exception 'MISSING_SALES_CHANNEL_ID: %', v_bill.doc_no; end if;
    if exists (
      select 1 from public.sales_bill_lines line
      where line.sales_bill_id = v_bill.id and line.status = 'active'
        and (line.product_id is null or line.cogs_amount is null or line.gross_profit is null)
    ) then raise exception 'INCOMPLETE_SALES_LINE_FACT: %', v_bill.doc_no; end if;

    insert into public.report_profit_cost_facts (
      source_type, source_doc_no, source_line_no, source_event_key, event_date,
      branch_id, product_id, customer_id, sales_channel_id, fact_type,
      quantity, revenue_amount, cogs_amount, source_updated_at
    )
    with active_lines as (
      select
        line.*,
        row_number() over (order by line.line_no, line.id) as row_no,
        count(*) over () as row_count,
        sum(line.line_amount) over () as line_amount_total
      from public.sales_bill_lines line
      where line.sales_bill_id = v_bill.id and line.status = 'active'
    ), allocated as (
      select
        active_lines.*,
        case
          when coalesce(v_bill.discount_total, 0) = 0 then 0::numeric
          when line_amount_total = 0 then
            case when row_no = row_count then round(v_bill.discount_total, 2) else 0::numeric end
          when row_no < row_count then
            round(v_bill.discount_total * line_amount / line_amount_total, 2)
          else
            round(v_bill.discount_total, 2) - coalesce(sum(
              round(v_bill.discount_total * line_amount / line_amount_total, 2)
            ) over (rows between unbounded preceding and 1 preceding), 0)
        end as allocated_header_discount
      from active_lines
    )
    select 'SALES_BILL', v_bill.doc_no, line.line_no, 'CURRENT', v_bill.date,
      v_bill.branch_id, line.product_id, v_bill.customer_id, v_bill.channel_id, 'SALE',
      round(line.qty, 3), round(line.line_amount - line.allocated_header_discount, 2),
      round(line.cogs_amount, 2), coalesce(v_bill.updated_at, v_bill.created_at, now())
    from allocated line;

    if round(coalesce(v_bill.cogs_amount, v_bill.total_cost, 0), 2) <> (
      select round(coalesce(sum(line.cogs_amount), 0), 2)
      from public.sales_bill_lines line
      where line.sales_bill_id = v_bill.id and line.status = 'active'
    ) then
      raise exception 'HEADER_LINE_COGS_MISMATCH: %', v_bill.doc_no;
    end if;
  end if;

  perform public.rebuild_profit_cost_daily(
    least(coalesce(v_old_min_date, v_bill.date), v_bill.date),
    greatest(coalesce(v_old_max_date, v_bill.date), v_bill.date)
  );
end;
$$;

create or replace function public.project_inserted_profit_cost_stock_ledger()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_from date;
  v_to date;
begin
  if exists (
    select 1 from inserted_profit_cost_stock_ledger row
    where row.branch_id is null or row.product_id is null
  ) then
    raise exception 'INCOMPLETE_STOCK_LEDGER_REPORT_DIMENSION';
  end if;

  delete from public.report_profit_cost_facts fact
  using inserted_profit_cost_stock_ledger row
  where fact.source_type = 'STOCK_LEDGER'
    and fact.source_event_key = row.ledger_key;

  insert into public.report_profit_cost_facts (
    source_type, source_doc_no, source_line_no, source_event_key, event_date,
    branch_id, product_id, purchase_channel_id, sales_channel_id, fact_type,
    stock_quantity_delta, stock_value_delta, source_updated_at
  )
  select
    'STOCK_LEDGER', coalesce(row.ref_no, row.ledger_key), 0, row.ledger_key, row.date,
    row.branch_id, row.product_id, row.purchase_channel_id, row.sales_channel_id, 'STOCK',
    round(coalesce(row.qty_in, 0) - coalesce(row.qty_out, 0), 3),
    round(coalesce(row.value_in, 0) - coalesce(row.value_out, 0), 2),
    coalesce(row.updated_at, row.created_at, now())
  from inserted_profit_cost_stock_ledger row;

  select min(date), max(date) into v_from, v_to
  from inserted_profit_cost_stock_ledger;
  if v_from is not null then
    perform public.rebuild_profit_cost_daily(v_from, v_to);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_project_inserted_profit_cost_stock_ledger on public.stock_ledger;
create trigger trg_project_inserted_profit_cost_stock_ledger
after insert on public.stock_ledger
referencing new table as inserted_profit_cost_stock_ledger
for each statement
execute function public.project_inserted_profit_cost_stock_ledger();

create or replace function public.project_profit_cost_stock_ledger(p_stock_ledger_id bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_ledger public.stock_ledger%rowtype;
  v_doc_no text;
  v_old_date date;
begin
  select * into v_ledger from public.stock_ledger where id = p_stock_ledger_id for update;
  if not found then raise exception 'STOCK_LEDGER_NOT_FOUND: %', p_stock_ledger_id; end if;
  v_doc_no := coalesce(v_ledger.ref_no, v_ledger.ledger_key);

  select min(event_date) into v_old_date from public.report_profit_cost_facts
  where source_type = 'STOCK_LEDGER' and source_doc_no = v_doc_no
    and source_event_key = v_ledger.ledger_key;
  delete from public.report_profit_cost_facts
  where source_type = 'STOCK_LEDGER' and source_doc_no = v_doc_no
    and source_event_key = v_ledger.ledger_key;

  if v_ledger.branch_id is null then raise exception 'MISSING_BRANCH_ID: %', v_doc_no; end if;
  if v_ledger.product_id is null then raise exception 'MISSING_PRODUCT_ID: %', v_doc_no; end if;

  insert into public.report_profit_cost_facts (
    source_type, source_doc_no, source_line_no, source_event_key, event_date,
    branch_id, product_id, purchase_channel_id, sales_channel_id, fact_type,
    stock_quantity_delta, stock_value_delta, source_updated_at
  ) values (
    'STOCK_LEDGER', v_doc_no, 0, v_ledger.ledger_key,
    v_ledger.date, v_ledger.branch_id, v_ledger.product_id,
    v_ledger.purchase_channel_id, v_ledger.sales_channel_id, 'STOCK',
    round(coalesce(v_ledger.qty_in, 0) - coalesce(v_ledger.qty_out, 0), 3),
    round(coalesce(v_ledger.value_in, 0) - coalesce(v_ledger.value_out, 0), 2),
    coalesce(v_ledger.updated_at, v_ledger.created_at, now())
  );

  perform public.rebuild_profit_cost_daily(
    least(coalesce(v_old_date, v_ledger.date), v_ledger.date),
    greatest(coalesce(v_old_date, v_ledger.date), v_ledger.date)
  );
end;
$$;

create or replace view public.report_profit_cost_reconciliation_issues as
select 'PURCHASE_BILL'::text as source_type, pb.doc_no as source_doc_no,
  case
    when pb.branch_id is null then 'MISSING_BRANCH_ID'
    when pb.supplier_id is null then 'MISSING_SUPPLIER_ID'
    when pb.purchase_channel_id is null then 'MISSING_PURCHASE_CHANNEL_ID'
    else 'MISSING_PRODUCT_ID'
  end as issue_code,
  now() as detected_at
from public.purchase_bills pb
left join public.purchase_bill_items pbi
  on pbi.purchase_bill_id = pb.id and pbi.item_status = 'active'
where lower(coalesce(pb.status, '')) not in ('draft', 'cancelled', 'canceled', 'void', 'voided', 'reversed')
  and (pb.branch_id is null or pb.supplier_id is null or pb.purchase_channel_id is null or pbi.product_id is null)
union all
select 'SALES_BILL', sb.doc_no,
  case
    when sb.branch_id is null then 'MISSING_BRANCH_ID'
    when sb.customer_id is null then 'MISSING_CUSTOMER_ID'
    when sb.channel_id is null then 'MISSING_SALES_CHANNEL_ID'
    when sbl.product_id is null then 'MISSING_PRODUCT_ID'
    else 'MISSING_LINE_COGS'
  end,
  now()
from public.sales_bills sb
left join public.sales_bill_lines sbl
  on sbl.sales_bill_id = sb.id and sbl.status = 'active'
where lower(coalesce(sb.status, '')) not in ('draft', 'cancelled', 'canceled', 'void', 'voided', 'reversed')
  and (sb.branch_id is null or sb.customer_id is null or sb.channel_id is null
    or sbl.product_id is null or sbl.cogs_amount is null or sbl.gross_profit is null)
union all
select 'SALES_BILL', sb.doc_no, 'HEADER_LINE_TOTAL_MISMATCH', now()
from public.sales_bills sb
join public.sales_bill_lines sbl on sbl.sales_bill_id = sb.id and sbl.status = 'active'
where lower(coalesce(sb.status, '')) not in ('draft', 'cancelled', 'canceled', 'void', 'voided', 'reversed')
group by sb.id, sb.doc_no, sb.cogs_amount, sb.total_cost
having round(coalesce(sb.cogs_amount, sb.total_cost, 0), 2)
  <> round(coalesce(sum(sbl.cogs_amount), 0), 2)
union all
select source_type, source_doc_no, 'FACT_SOURCE_MISMATCH', now()
from public.report_profit_cost_facts fact
where fact.fact_type in ('PURCHASE', 'SALE')
group by source_type, source_doc_no
having
  (source_type = 'PURCHASE_BILL' and not exists (
    select 1 from public.purchase_bills pb where pb.doc_no = source_doc_no
  ))
  or (source_type = 'SALES_BILL' and not exists (
    select 1 from public.sales_bills sb where sb.doc_no = source_doc_no
  ))
union all
select 'DAILY_ROLLUP', event_date::text, 'ROLLUP_FACT_MISMATCH', now()
from (
  select
    coalesce(f.event_date, d.event_date) as event_date,
    coalesce(f.purchase_amount, 0) as fact_purchase_amount,
    coalesce(d.purchase_amount, 0) as daily_purchase_amount,
    coalesce(f.revenue_amount, 0) as fact_revenue_amount,
    coalesce(d.revenue_amount, 0) as daily_revenue_amount,
    coalesce(f.cogs_amount, 0) as fact_cogs_amount,
    coalesce(d.cogs_amount, 0) as daily_cogs_amount,
    coalesce(f.stock_value_delta, 0) as fact_stock_value_delta,
    coalesce(d.stock_value_delta, 0) as daily_stock_value_delta
  from (
    select event_date, sum(purchase_amount) purchase_amount, sum(revenue_amount) revenue_amount,
      sum(cogs_amount) cogs_amount, sum(stock_value_delta) stock_value_delta
    from public.report_profit_cost_facts group by event_date
  ) f
  full join (
    select event_date, sum(purchase_amount) purchase_amount, sum(revenue_amount) revenue_amount,
      sum(cogs_amount) cogs_amount, sum(stock_value_delta) stock_value_delta
    from public.report_profit_cost_daily group by event_date
  ) d using (event_date)
) mismatch
where fact_purchase_amount <> daily_purchase_amount
  or fact_revenue_amount <> daily_revenue_amount
  or fact_cogs_amount <> daily_cogs_amount
  or fact_stock_value_delta <> daily_stock_value_delta;

insert into public.system_settings (key, value, description, updated_by)
values (
  'profit_cost_target_margin_pct',
  '8.00',
  'Target gross-margin percentage used by Profit & Cost Analysis alerts.',
  'migration:20260719160000'
)
on conflict (key) do nothing;

comment on column public.sales_bill_lines.cogs_amount is
  'Recorded COGS for this exact normalized sales-bill line. NULL means the source contract has not been reconciled; report code must not derive a fallback.';

comment on column public.sales_bill_lines.gross_profit is
  'Recorded line gross profit: line_amount (already net of line discount) minus cogs_amount.';

comment on column public.purchase_bills.purchase_channel_id is
  'Internal purchase-channel master reference selected at the purchase-bill write boundary; report code must not infer this value from purchase_source text.';

comment on table public.report_profit_cost_facts is
  'L5 reporting read model projected from normalized transaction lines. Direct application writes are prohibited.';

comment on table public.report_profit_cost_daily is
  'Incremental daily rollup derived only from report_profit_cost_facts.';

commit;
