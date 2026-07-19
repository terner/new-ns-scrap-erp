import { NextRequest } from 'next/server'
import { authorizeProfitCostRequest, profitCostJson, profitCostRouteError, scopedProfitCostTableQuery } from '../_shared'
import { PRODUCT_SORT_FIELDS, readProfitCostProducts } from '@/lib/server/profit-cost-report-reader'

export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  try {
    const { context, startedAt } = await authorizeProfitCostRequest(request)
    return profitCostJson(await readProfitCostProducts(await scopedProfitCostTableQuery(request, context, PRODUCT_SORT_FIELDS)), startedAt)
  } catch (caught) { return profitCostRouteError(caught) }
}
