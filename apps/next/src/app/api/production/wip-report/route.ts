import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { loadProductionMetrics, summarizeProductionMetrics } from '@/lib/server/production-reports'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'production.operations.view')
    const rows = (await loadProductionMetrics()).filter((row) => row.wipQty > 0).sort((a, b) => b.wipQty - a.wipQty)
    return NextResponse.json({ rows, summary: summarizeProductionMetrics(rows) })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลด WIP คงเหลือไม่ได้', 500)
  }
}
