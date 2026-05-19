import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { buildCashFlowForecastCalendar } from '@/lib/server/finance-accounting-cashflow-planning'

export const runtime = 'nodejs'

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function parseHorizon(value: string | null) {
  const parsed = Number.parseInt(value ?? '30', 10)
  return [7, 30, 90].includes(parsed) ? parsed : 30
}

export async function GET(request: NextRequest) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.financials.view')

    const params = request.nextUrl.searchParams
    const payload = await buildCashFlowForecastCalendar({
      branchId: params.get('branchId') || undefined,
      horizon: parseHorizon(params.get('horizon')),
      startDate: parseDate(params.get('startDate'), new Date()),
    })

    return NextResponse.json(payload)
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลด CF Forecast Calendar ไม่ได้', 500)
  }
}
