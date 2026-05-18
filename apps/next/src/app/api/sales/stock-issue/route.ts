import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'stock.ledger.view')

    const rows = await prisma.stock_issues.findMany({
      include: {
        branches: true,
        customers: true,
        warehouses: true,
      },
      orderBy: [{ date: 'desc' }, { doc_no: 'desc' }],
      take: 5000,
    })

    return NextResponse.json({
      rows: rows.map((row) => ({
        branchName: row.branches?.name ?? '-',
        convertedToBillId: row.converted_to_bill_id ?? '',
        customerName: row.customers?.name ?? row.customer_id ?? '-',
        date: toDateOnly(row.date),
        docNo: row.doc_no,
        id: row.id,
        itemCount: Array.isArray(row.items) ? row.items.length : 0,
        status: row.status ?? 'pending',
        totalCost: toNumber(row.total_cost),
        totalEstAmount: toNumber(row.total_est_amount),
        warehouseName: row.warehouses?.name ?? '-',
      })),
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดเบิกออกรอบิลไม่ได้', 500)
  }
}
