import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { loadProductionMetrics, summarizeProductionMetrics } from '@/lib/server/production-reports'

export const runtime = 'nodejs'

function defaultRange() {
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 29)
  return { dateFrom: start.toISOString().slice(0, 10), dateTo: end.toISOString().slice(0, 10) }
}

export async function GET(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'production.operations.view')
    const url = new URL(request.url)
    const fallback = defaultRange()
    const rows = await loadProductionMetrics({
      dateFrom: url.searchParams.get('dateFrom') || fallback.dateFrom,
      dateTo: url.searchParams.get('dateTo') || fallback.dateTo,
    })
    const summary = summarizeProductionMetrics(rows)
    const byStatus = Object.values(rows.reduce<Record<string, { count: number; status: string }>>((acc, row) => {
      acc[row.status] ??= { count: 0, status: row.status }
      acc[row.status].count += 1
      return acc
    }, {}))
    const topProducts = Object.values(rows.reduce<Record<string, { batches: number; cost: number; name: string; qty: number }>>((acc, row) => {
      acc[row.productName] ??= { batches: 0, cost: 0, name: row.productName, qty: 0 }
      acc[row.productName].batches += 1
      acc[row.productName].qty += row.outputQty
      acc[row.productName].cost += row.outputValue
      return acc
    }, {})).sort((a, b) => b.qty - a.qty).slice(0, 10)

    return NextResponse.json({ rows: rows.slice(0, 20), summary, byStatus, topProducts })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลด Production Dashboard ไม่ได้', 500)
  }
}
