import { prisma } from '../src/lib/server/prisma'

async function main() {
  const issues = await prisma.$queryRaw<Array<{ count: bigint }>>`
    select count(*)::bigint as count from public.report_profit_cost_reconciliation_issues
  `
  const parity = await prisma.$queryRaw<Array<{
    daily_cogs: string; daily_purchase: string; daily_revenue: string
    fact_cogs: string; fact_purchase: string; fact_revenue: string
  }>>`
    select
      (select coalesce(sum(purchase_amount), 0)::text from public.report_profit_cost_facts) fact_purchase,
      (select coalesce(sum(revenue_amount), 0)::text from public.report_profit_cost_facts) fact_revenue,
      (select coalesce(sum(cogs_amount), 0)::text from public.report_profit_cost_facts) fact_cogs,
      (select coalesce(sum(purchase_amount), 0)::text from public.report_profit_cost_daily) daily_purchase,
      (select coalesce(sum(revenue_amount), 0)::text from public.report_profit_cost_daily) daily_revenue,
      (select coalesce(sum(cogs_amount), 0)::text from public.report_profit_cost_daily) daily_cogs
  `
  const row = parity[0]
  if (!row) throw new Error('REPORT_PARITY_RESULT_MISSING')
  const mismatch = row.fact_purchase !== row.daily_purchase
    || row.fact_revenue !== row.daily_revenue
    || row.fact_cogs !== row.daily_cogs
  const issueCount = Number(issues[0]?.count ?? 0n)
  console.log(JSON.stringify({ issueCount, mismatch, totals: row }))
  if (issueCount > 0 || mismatch) process.exitCode = 1
}

main().finally(() => prisma.$disconnect())
