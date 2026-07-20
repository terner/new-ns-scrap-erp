import { prisma } from '../src/lib/server/prisma'
import { normalizeSalesBillProfitCostSource } from '../src/lib/server/sales-bill-profit-cost-source'

async function main() {
  const missingStockDimensions = await prisma.stock_ledger.count({
    where: { OR: [{ branch_id: null }, { product_id: null }] },
  })
  if (missingStockDimensions > 0) {
    throw new Error(`BACKFILL_STOPPED: ${missingStockDimensions} stock ledger rows have incomplete dimensions`)
  }

  const salesBills = await prisma.sales_bills.findMany({
    orderBy: { id: 'asc' },
    select: { doc_no: true, id: true },
    where: { status: { notIn: ['draft', 'cancelled', 'canceled', 'void', 'voided', 'reversed'] } },
  })
  for (const bill of salesBills) {
    await prisma.$transaction(async (tx) => {
      await normalizeSalesBillProfitCostSource(tx, {
        actor: 'backfill:profit-cost-report',
        preserveAuditFields: true,
        salesBillDocNo: bill.doc_no,
        salesBillId: bill.id,
      })
      await tx.$executeRaw`select public.project_profit_cost_sales_bill(${bill.id}::bigint)`
    }, { timeout: 30_000 })
  }

  const purchaseBills = await prisma.purchase_bills.findMany({ orderBy: { id: 'asc' }, select: { id: true } })
  for (const bill of purchaseBills) {
    await prisma.$executeRaw`select public.project_profit_cost_purchase_bill(${bill.id}::bigint)`
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`delete from public.report_profit_cost_facts where source_type = 'STOCK_LEDGER'`
    await tx.$executeRaw`
      insert into public.report_profit_cost_facts (
        source_type, source_doc_no, source_line_no, source_event_key, event_date,
        branch_id, product_id, purchase_channel_id, sales_channel_id, fact_type,
        stock_quantity_delta, stock_value_delta, source_updated_at
      )
      select 'STOCK_LEDGER', coalesce(ref_no, ledger_key), 0, ledger_key, date,
        branch_id, product_id, purchase_channel_id, sales_channel_id, 'STOCK',
        round(coalesce(qty_in, 0) - coalesce(qty_out, 0), 3),
        round(coalesce(value_in, 0) - coalesce(value_out, 0), 2),
        coalesce(updated_at, created_at, now())
      from public.stock_ledger
    `
    await tx.$executeRaw`
      select public.rebuild_profit_cost_daily(
        (select min(event_date) from public.report_profit_cost_facts),
        (select max(event_date) from public.report_profit_cost_facts)
      )
    `
  }, { timeout: 120_000 })

  const issues = await prisma.$queryRaw<Array<{ issue_code: string; source_doc_no: string; source_type: string }>>`
    select source_type, source_doc_no, issue_code
    from public.report_profit_cost_reconciliation_issues
    order by source_type, source_doc_no, issue_code
    limit 100
  `
  if (issues.length > 0) {
    console.error(JSON.stringify(issues, null, 2))
    throw new Error(`BACKFILL_RECONCILIATION_FAILED: ${issues.length} issue(s) found`)
  }
  const [factCount, dailyCount] = await Promise.all([
    prisma.report_profit_cost_facts.count(),
    prisma.report_profit_cost_daily.count(),
  ])
  console.log(JSON.stringify({ dailyCount, factCount, purchaseBills: purchaseBills.length, salesBills: salesBills.length }))
}

main().finally(() => prisma.$disconnect())
