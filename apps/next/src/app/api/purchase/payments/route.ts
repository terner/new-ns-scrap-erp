import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { supplierPaymentFormSchema } from '@/lib/daily'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { currentActor, listDailyAccounts, nextDailyDocNo, normalizeDate, toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const [accounts, suppliers, bills, payments] = await Promise.all([
      listDailyAccounts(),
      prisma.suppliers.findMany({ orderBy: [{ name: 'asc' }], select: { active: true, id: true, name: true } }),
      prisma.purchase_bills.findMany({
        orderBy: [{ date: 'desc' }],
        select: { doc_no: true, id: true, payable_balance: true, supplier_id: true, total_amount: true },
        take: 5000,
      }),
      prisma.payments.findMany({
        include: { accounts: true, suppliers: true },
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
        take: 5000,
      }),
    ])

    return NextResponse.json({
      accounts,
      bills: bills.map((bill) => ({
        docNo: bill.doc_no,
        id: bill.id,
        payableBalance: toNumber(bill.payable_balance),
        supplierId: bill.supplier_id,
        totalAmount: toNumber(bill.total_amount),
      })),
      rows: payments.map((payment) => ({
        accountId: payment.account_id ?? '',
        accountName: payment.accounts?.name ?? '-',
        amount: toNumber(payment.amount),
        billId: payment.bill_id ?? '',
        date: toDateOnly(payment.date),
        docNo: payment.doc_no,
        fee: toNumber(payment.fee ?? payment.bank_fee),
        id: payment.id,
        method: payment.method ?? '',
        netAmount: toNumber(payment.net_amount),
        notes: payment.notes ?? '',
        partyName: payment.suppliers?.name ?? payment.supplier_id ?? '-',
        supplierId: payment.supplier_id ?? '',
        supplierName: payment.suppliers?.name ?? payment.supplier_id ?? '-',
        withholdingTax: toNumber(payment.withholding_tax),
      })),
      suppliers,
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดรายการจ่ายเงิน Supplier ไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const values = supplierPaymentFormSchema.parse(await request.json())
    const id = values.id ?? `PMT-${randomUUID()}`
    const docNo = values.docNo ?? await nextDailyDocNo('payments', 'PMT', values.date)
    const actor = currentActor(context)
    const netAmount = values.amount + values.fee - values.withholdingTax - values.discount

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payments.upsert({
        where: { id },
        create: {
          account_id: values.accountId,
          amount: values.amount,
          bank_fee: values.fee,
          bill_id: values.billId,
          created_by: actor,
          date: normalizeDate(values.date),
          discount: values.discount,
          doc_no: docNo,
          fee: values.fee,
          id,
          method: values.method,
          net_amount: netAmount,
          notes: values.notes,
          status: 'active',
          supplier_id: values.supplierId,
          updated_at: new Date(),
          updated_by: actor,
          voucher_id: id,
          withholding_tax: values.withholdingTax,
        },
        update: {
          account_id: values.accountId,
          amount: values.amount,
          bank_fee: values.fee,
          bill_id: values.billId,
          date: normalizeDate(values.date),
          discount: values.discount,
          doc_no: docNo,
          fee: values.fee,
          method: values.method,
          net_amount: netAmount,
          notes: values.notes,
          supplier_id: values.supplierId,
          updated_at: new Date(),
          updated_by: actor,
          voucher_id: id,
          withholding_tax: values.withholdingTax,
        },
      })

      await tx.bank_statement.deleteMany({ where: { ref_id: id, ref_type: 'PMT' } })
      await tx.bank_statement.create({
        data: {
          account_id: values.accountId,
          amount_in: 0,
          amount_out: netAmount,
          created_by: actor,
          date: normalizeDate(values.date),
          description: `${docNo} - จ่าย Supplier`,
          id: `BS-PMT-${id}`,
          ref_id: id,
          ref_no: docNo,
          ref_type: 'PMT',
          type: 'จ่ายเงิน Supplier',
        },
      })

      return payment
    })

    return NextResponse.json({ id: result.id })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'บันทึกจ่ายเงิน Supplier ไม่ได้', 400)
  }
}
