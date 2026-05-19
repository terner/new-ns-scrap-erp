import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { buildWorkingCapital } from '@/lib/server/finance-accounting-working-capital'

export const runtime = 'nodejs'

function parseDate(value: string | null, fallback: Date) {
  if (!value) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

function parsePeriodDays(value: string | null) {
  const parsed = Number.parseInt(value ?? '90', 10)
  return [30, 60, 90, 180, 365].includes(parsed) ? parsed : 90
}

export async function GET(request: NextRequest) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.financials.view')

    const params = request.nextUrl.searchParams
    const payload = await buildWorkingCapital({
      asOf: parseDate(params.get('asOf'), new Date()),
      branchId: params.get('branchId') || undefined,
      periodDays: parsePeriodDays(params.get('periodDays')),
    })

    return NextResponse.json(payload)
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลด Working Capital Analysis ไม่ได้', 500)
  }
}
