import { NextRequest } from 'next/server'
import { authorizeProfitCostRequest, profitCostJson, profitCostRouteError, scopedProfitCostFilter } from '../_shared'
import { readProfitCostRankings } from '@/lib/server/profit-cost-report-reader'

export const runtime = 'nodejs'
export async function GET(request: NextRequest) {
  try {
    const { context, startedAt } = await authorizeProfitCostRequest(request)
    return profitCostJson(await readProfitCostRankings(await scopedProfitCostFilter(request, context)), startedAt)
  } catch (caught) { return profitCostRouteError(caught) }
}
