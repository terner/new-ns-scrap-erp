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

    const rows = await prisma.sales_bills.findMany({
      include: {
        branches: true,
        customers: true,
        sales_channels: true,
        warehouses: true,
      },
      orderBy: [{ date: 'desc' }, { doc_no: 'desc' }],
      take: 5000,
    })

    return NextResponse.json({
      rows: rows.map((row) => ({
        branchName: row.branches?.name ?? '-',
        channelName: row.sales_channels?.name ?? '-',
        customerName: row.customers?.name ?? row.customer_id ?? '-',
        date: toDateOnly(row.date),
        docNo: row.doc_no,
        grossProfit: toNumber(row.gross_profit),
        id: row.id,
        itemCount: Array.isArray(row.items) ? row.items.length : 0,
        receivableBalance: toNumber(row.receivable_balance),
        receivedAmount: toNumber(row.received_amount),
        status: row.status ?? 'open',
        totalAmount: toNumber(row.total_amount),
        warehouseName: row.warehouses?.name ?? '-',
      })),
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดบิลขายไม่ได้', 500)
  }
}
