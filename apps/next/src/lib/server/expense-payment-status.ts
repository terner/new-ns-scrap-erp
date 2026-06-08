import type { Prisma } from '../../../generated/prisma/client'
import { toNumber } from '@/lib/server/daily'

type DecimalLike = Parameters<typeof toNumber>[0]

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function expensePayableAmount(expense: {
  amount: DecimalLike
  net_amount: DecimalLike
  vat: DecimalLike
  wht: DecimalLike
}) {
  const netAmount = toNumber(expense.net_amount)
  if (netAmount > 0) return netAmount
  return roundMoney(toNumber(expense.amount) + toNumber(expense.vat) - toNumber(expense.wht))
}

export async function refreshExpensePaymentStatus(
  tx: Prisma.TransactionClient,
  expenseId: bigint,
  actor: string,
) {
  const [expense, approvals] = await Promise.all([
    tx.expenses.findUnique({
      select: {
        amount: true,
        id: true,
        net_amount: true,
        paid_at: true,
        status: true,
        vat: true,
        wht: true,
      },
      where: { id: expenseId },
    }),
    tx.payment_approvals.findMany({
      select: { approved_amount: true, id: true },
      where: {
        source_id: expenseId.toString(),
        source_type: 'expense',
        status: { in: ['approved', 'paid'] },
      },
    }),
  ])

  if (!expense || expense.status === 'cancelled') return

  let settledTotal = 0
  for (const approval of approvals) {
    const activePayments = await tx.payments.findMany({
      select: { amount: true, discount: true, status: true, withholding_tax: true },
      where: {
        payment_approval_id: approval.id,
        NOT: { status: 'cancelled' },
      },
    })
    settledTotal += activePayments.reduce((sum, payment) => (
      sum + toNumber(payment.amount) + toNumber(payment.withholding_tax) + toNumber(payment.discount)
    ), 0)
  }

  const payableAmount = expensePayableAmount(expense)
  const nextStatus = settledTotal >= payableAmount - 0.01
    ? 'paid'
    : approvals.length > 0
      ? 'approved'
      : 'pending_approval'
  const updatedAt = new Date()

  await tx.expenses.update({
    data: {
      paid_at: nextStatus === 'paid' ? expense.paid_at ?? updatedAt : null,
      paid_status: nextStatus === 'paid' ? 'paid' : 'unpaid',
      status: nextStatus,
      updated_at: updatedAt,
      updated_by: actor,
    },
    where: { id: expenseId },
  })
}
