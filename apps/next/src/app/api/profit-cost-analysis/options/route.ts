import { NextRequest } from 'next/server'
import { allowedProfitCostBranchIds, authorizeProfitCostRequest, profitCostJson, profitCostRouteError } from '../_shared'
import { readProfitCostOptions } from '@/lib/server/profit-cost-report-reader'

export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  try {
    const { context, startedAt } = await authorizeProfitCostRequest(request)
    return profitCostJson(await readProfitCostOptions(await allowedProfitCostBranchIds(context)), startedAt)
  } catch (caught) { return profitCostRouteError(caught) }
}
