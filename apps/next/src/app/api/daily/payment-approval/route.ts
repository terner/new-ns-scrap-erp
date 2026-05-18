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

    const [purchaseBills, expenses] = await Promise.all([
      prisma.purchase_bills.findMany({
        include: { suppliers: true },
        orderBy: [{ date: 'asc' }, { doc_no: 'asc' }],
        take: 5000,
        where: {
          NOT: { status: 'cancelled' },
        },
      }),
      prisma.expenses.findMany({
        include: { accounts: true },
        orderBy: [{ date: 'asc' }, { doc_no: 'asc' }],
        take: 5000,
        where: {
          paid_status: { not: 'paid' },
        },
      }),
    ])

    const apRows = purchaseBills
      .map((bill) => {
        const totalAmount = toNumber(bill.total_amount)
        const paidAmount = toNumber(bill.paid_amount)
        const payableBalance = Math.max(0, toNumber(bill.payable_balance) || totalAmount - paidAmount)
        return {
          bankAccount: bill.suppliers?.bank_account ?? '',
          bankName: bill.suppliers?.bank_name ?? '',
          date: toDateOnly(bill.date),
          docNo: bill.doc_no,
          id: bill.id,
          paidAmount,
          payableBalance,
          supplierName: bill.suppliers?.name ?? bill.supplier_id ?? '-',
          totalAmount,
        }
      })
      .filter((row) => row.payableBalance > 0.01)

    const expenseRows = expenses.map((expense) => {
      const amount = toNumber(expense.net_amount) || toNumber(expense.amount) + toNumber(expense.vat) - toNumber(expense.wht)
      return {
        accountName: expense.accounts?.name ?? '',
        date: toDateOnly(expense.date),
        docNo: expense.doc_no,
        dueDate: toDateOnly(expense.due_date),
        id: expense.id,
        payee: expense.payee ?? '-',
        refDocNo: expense.ref_doc_no ?? '',
        totalAmount: amount,
      }
    })

    return NextResponse.json({ apRows, expenseRows })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดรายการอนุมัติโอนเงินไม่ได้', 500)
  }
}
