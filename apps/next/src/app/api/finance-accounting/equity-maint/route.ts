import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.financials.view')

    const row = await prisma.equity.findFirst({ orderBy: { updated_at: 'desc' } })
    const paidUpCapital = toNumber(row?.paid_up_capital)
    const retainedEarnings = toNumber(row?.retained_earnings)
    const ownerEquityAdjustment = toNumber(row?.owner_equity_adjustment)
    return NextResponse.json({
      designState: {
        missingFields: ['registeredCapital'],
        writeBehavior: 'disabled_until_retained_earnings_rollforward_design',
      },
      row: {
        ownerEquityAdjustment,
        paidUpCapital,
        registeredCapital: paidUpCapital,
        retainedEarnings,
        totalEquity: paidUpCapital + retainedEarnings + ownerEquityAdjustment,
        updatedAt: row?.updated_at?.toISOString() || '',
      },
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลด Equity ไม่ได้', 500)
  }
}
