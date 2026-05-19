import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function categoryLabel(categoryId: string | null, metricType: string | null) {
  if (!categoryId) return 'ไม่ระบุหมวด'
  if (looksLikeUuid(categoryId)) return `${metricType || 'historical'} / ไม่ระบุชื่อหมวด`
  return categoryId
}

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.financials.view')

    const rows = await prisma.historical_monthly.findMany({
      orderBy: [{ year: 'asc' }, { month: 'asc' }, { metric_type: 'asc' }, { category_id: 'asc' }],
      take: 5000,
    })

    return NextResponse.json({
      designState: {
        clearWrite: 'disabled_until_cutover_approval',
        saveWrite: 'disabled_until_cutover_approval',
      },
      months: [
        { label: 'ม.ค. 2026', month: 1, year: 2026 },
        { label: 'ก.พ. 2026', month: 2, year: 2026 },
        { label: 'มี.ค. 2026', month: 3, year: 2026 },
        { label: 'เม.ย. 2026', month: 4, year: 2026 },
      ],
      rows: rows.map((row) => ({
        amount: toNumber(row.amount),
        categoryId: row.category_id || '-',
        categoryLabel: categoryLabel(row.category_id, row.metric_type),
        metricType: row.metric_type || '-',
        month: row.month || 0,
        note: row.note || '',
        refNo: `HIST-${row.year || 0}${String(row.month || 0).padStart(2, '0')}-${row.metric_type || 'NA'}-${row.category_id || 'NA'}`,
        year: row.year || 0,
      })),
      summary: {
        cashflow: rows.filter((row) => row.metric_type === 'cashflow').length,
        expense: rows.filter((row) => row.metric_type === 'expense').length,
        pnl: rows.filter((row) => row.metric_type === 'pnl').length,
        total: rows.length,
      },
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดข้อมูลย้อนหลังไม่ได้', 500)
  }
}
