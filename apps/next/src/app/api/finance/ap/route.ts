import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

function ageBucket(days: number) {
  if (days <= 0) return 'Current'
  if (days <= 30) return '1-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '>90'
}

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const [bills, payments] = await Promise.all([
      prisma.purchase_bills.findMany({
        include: {
          purchase_channels: true,
          suppliers: true,
        },
        orderBy: [{ date: 'asc' }, { doc_no: 'asc' }],
        take: 10000,
        where: { NOT: { status: 'cancelled' } },
      }),
      prisma.payments.findMany({
        select: {
          amount: true,
          bill_id: true,
          discount: true,
          status: true,
          withholding_tax: true,
        },
        take: 10000,
        where: { NOT: { status: 'cancelled' } },
      }),
    ])

    const paidMap = new Map<string, number>()
    payments.forEach((payment) => {
      if (!payment.bill_id) return
      const total = toNumber(payment.amount) + toNumber(payment.withholding_tax) + toNumber(payment.discount)
      paidMap.set(payment.bill_id, (paidMap.get(payment.bill_id) ?? 0) + total)
    })

    const today = new Date()
    const rows = bills
      .map((bill) => {
        const totalAmount = toNumber(bill.total_amount)
        const paidAmount = paidMap.get(bill.id) ?? toNumber(bill.paid_amount)
        const payableBalance = Math.max(0, totalAmount - paidAmount)
        const creditTerm = bill.suppliers?.credit_term ?? 0
        const due = new Date(bill.date)
        due.setDate(due.getDate() + creditTerm)
        const aging = Math.floor((today.getTime() - due.getTime()) / 86400000)

        return {
          aging,
          bucket: ageBucket(aging),
          channelName: bill.purchase_channels?.name ?? '-',
          creditTerm,
          date: toDateOnly(bill.date),
          docNo: bill.doc_no,
          dueDate: toDateOnly(due),
          id: bill.id,
          paidAmount,
          payableBalance,
          supplierId: bill.supplier_id ?? '',
          supplierName: bill.suppliers?.name ?? bill.supplier_id ?? '-',
          totalAmount,
          transactionMode: bill.transaction_mode ?? 'STOCK',
        }
      })
      .filter((row) => row.payableBalance > 0.01)

    const supplierMap = new Map<string, {
      bills: number
      current: number
      gt90: number
      oldest: number
      supplierId: string
      supplierName: string
      total: number
      b30: number
      b60: number
      b90: number
    }>()

    rows.forEach((row) => {
      const current = supplierMap.get(row.supplierId) ?? {
        b30: 0,
        b60: 0,
        b90: 0,
        bills: 0,
        current: 0,
        gt90: 0,
        oldest: 0,
        supplierId: row.supplierId,
        supplierName: row.supplierName,
        total: 0,
      }
      current.bills += 1
      current.total += row.payableBalance
      current.oldest = Math.max(current.oldest, row.aging)
      if (row.bucket === 'Current') current.current += row.payableBalance
      else if (row.bucket === '1-30') current.b30 += row.payableBalance
      else if (row.bucket === '31-60') current.b60 += row.payableBalance
      else if (row.bucket === '61-90') current.b90 += row.payableBalance
      else current.gt90 += row.payableBalance
      supplierMap.set(row.supplierId, current)
    })

    const bySupplier = Array.from(supplierMap.values()).sort((left, right) => right.total - left.total)
    const byBucket = ['Current', '1-30', '31-60', '61-90', '>90'].map((bucket) => ({
      bucket,
      bills: rows.filter((row) => row.bucket === bucket).length,
      total: rows.filter((row) => row.bucket === bucket).reduce((sum, row) => sum + row.payableBalance, 0),
    }))

    return NextResponse.json({
      byBucket,
      bySupplier,
      rows,
      summary: {
        bills: rows.length,
        dueIn7: rows.filter((row) => row.aging >= -7 && row.aging <= 0).reduce((sum, row) => sum + row.payableBalance, 0),
        overdue: rows.filter((row) => row.aging > 0).reduce((sum, row) => sum + row.payableBalance, 0),
        suppliers: bySupplier.length,
        total: rows.reduce((sum, row) => sum + row.payableBalance, 0),
      },
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดเจ้าหนี้ AP ไม่ได้', 500)
  }
}
