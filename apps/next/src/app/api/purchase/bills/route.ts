import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const rows = await prisma.purchase_bills.findMany({
      include: {
        branches: true,
        purchase_channels: true,
        suppliers: true,
        warehouses: true,
      },
      orderBy: [{ date: 'desc' }, { doc_no: 'desc' }],
      take: 5000,
    })

    return NextResponse.json({
      rows: rows.map((row) => ({
        branchName: row.branches?.name ?? '-',
        channelName: row.purchase_channels?.name ?? '-',
        date: toDateOnly(row.date),
        docNo: row.doc_no,
        id: row.id,
        itemCount: Array.isArray(row.items) ? row.items.length : 0,
        paidAmount: toNumber(row.paid_amount),
        payableBalance: toNumber(row.payable_balance),
        status: row.status ?? 'open',
        supplierName: row.suppliers?.name ?? row.supplier_id ?? '-',
        totalAmount: toNumber(row.total_amount),
        warehouseName: row.warehouses?.name ?? '-',
      })),
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดบิลรับซื้อไม่ได้', 500)
  }
}
