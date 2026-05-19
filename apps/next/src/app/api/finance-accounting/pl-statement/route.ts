import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { buildPlStatement } from '@/lib/server/finance-accounting-statements'

export const runtime = 'nodejs'

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function firstDayOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export async function GET(request: NextRequest) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.financials.view')

    const params = request.nextUrl.searchParams
    const now = new Date()
    const from = parseDate(params.get('from'), firstDayOfMonth(now))
    const to = parseDate(params.get('to'), now)
    const transactionMode = params.get('transactionMode')
    const payload = await buildPlStatement({
      branchId: params.get('branchId') || undefined,
      from,
      to,
      transactionMode: transactionMode === 'STOCK' || transactionMode === 'TRADING' ? transactionMode : 'ALL',
    })

    return NextResponse.json(payload)
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดงบกำไรขาดทุนเพื่อการบริหารไม่ได้', 500)
  }
}
