import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { bangkokDateStart, toBangkokDateOnly } from '@/lib/server/daily'
import { getFinanceBranchCodeIntersection } from '@/lib/server/finance-accounting-branch-scope'
import { FinancialStatementInputError } from '@/lib/server/finance-accounting-statements'
import { buildStockFinance } from '@/lib/server/finance-accounting-working-capital'

export const runtime = 'nodejs'

function parseDateOnly(value: string | null, fallback: string) {
  const dateOnly = value?.trim() || fallback
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    throw new FinancialStatementInputError('ณ วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD')
  }
  const parsed = bangkokDateStart(dateOnly)
  if (Number.isNaN(parsed.getTime()) || toBangkokDateOnly(parsed) !== dateOnly) {
    throw new FinancialStatementInputError('ณ วันที่ไม่ถูกต้อง')
  }
  return parsed
}

export async function GET(request: NextRequest) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.financials.view')

    const params = request.nextUrl.searchParams
    const branchParam = params.get('branchId')?.trim().toUpperCase()
    const branchId = branchParam && branchParam !== 'ALL' ? branchParam : undefined
    const allowedBranchCodes = getFinanceBranchCodeIntersection(context)

    if (branchId && getFinanceBranchCodeIntersection(context, branchId)?.length === 0) {
      return apiErrorResponse(new FinancialStatementInputError('ไม่มีสิทธิ์ดูข้อมูลของสาขาที่ระบุ', 403), 'ไม่มีสิทธิ์ดูข้อมูลของสาขาที่ระบุ', 403)
    }

    const payload = await buildStockFinance({
      allowedBranchCodes,
      asOf: parseDateOnly(params.get('asOf'), toBangkokDateOnly(new Date())),
      branchId,
      periodDays: 90,
    })

    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    if (caught instanceof FinancialStatementInputError) return apiErrorResponse(caught, caught.message, caught.status)
    return apiErrorResponse(caught, 'โหลด Stock Finance Analysis ไม่ได้', 500)
  }
}
