import { NextRequest } from 'next/server'
import { authorizeProfitCostRequest, profitCostJson, profitCostRouteError, scopedProfitCostTableQuery } from '../_shared'
import { DIMENSION_SORT_FIELDS, readProfitCostDimension } from '@/lib/server/profit-cost-report-reader'
export const runtime = 'nodejs'
export async function GET(request: NextRequest) { try { const { context, startedAt } = await authorizeProfitCostRequest(request); return profitCostJson(await readProfitCostDimension('channels', await scopedProfitCostTableQuery(request, context, DIMENSION_SORT_FIELDS)), startedAt) } catch (caught) { return profitCostRouteError(caught) } }
