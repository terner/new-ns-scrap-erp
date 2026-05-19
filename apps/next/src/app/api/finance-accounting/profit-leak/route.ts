import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { buildProfitLeak } from '@/lib/server/finance-accounting-working-capital'

export const runtime = 'nodejs'

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function parseTargetMargin(value: string | null) {
  const parsed = Number.parseFloat(value ?? '5')
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5
}

export async function GET(request: NextRequest) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.financials.view')

    const now = new Date()
    const params = request.nextUrl.searchParams
    const payload = await buildProfitLeak({
      branchId: params.get('branchId') || undefined,
      from: parseDate(params.get('from'), monthStart(now)),
      targetMargin: parseTargetMargin(params.get('targetMargin')),
      to: parseDate(params.get('to'), now),
    })

    return NextResponse.json(payload)
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลด Profit Leak Dashboard ไม่ได้', 500)
  }
}
