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

    const rows = await prisma.receipt_vouchers.findMany({
      orderBy: [{ date: 'desc' }, { doc_no: 'desc' }],
      take: 5000,
    })

    return NextResponse.json({
      rows: rows.map((row) => ({
        amountInWords: row.amount_in_words ?? '',
        date: toDateOnly(row.date),
        docNo: row.doc_no ?? row.id,
        id: row.id,
        licensePlate: row.license_plate ?? '',
        note: row.note ?? '',
        purchaseBillDocNo: row.purchase_bill_doc_no ?? '',
        sellerName: row.seller_name ?? '',
        sellerPhone: row.seller_phone ?? '',
        sellerTaxId: row.seller_tax_id ?? '',
        totalAmount: toNumber(row.total_amount),
        totalQty: toNumber(row.total_qty),
      })),
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดใบสำคัญรับเงินไม่ได้', 500)
  }
}
