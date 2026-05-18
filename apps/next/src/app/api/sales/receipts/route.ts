import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { customerReceiptFormSchema } from '@/lib/daily'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { currentActor, listDailyAccounts, nextDailyDocNo, normalizeDate, toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const [accounts, customers, bills, receipts] = await Promise.all([
      listDailyAccounts(),
      prisma.customers.findMany({ orderBy: [{ name: 'asc' }], select: { active: true, id: true, name: true } }),
      prisma.sales_bills.findMany({
        orderBy: [{ date: 'desc' }],
        select: { customer_id: true, doc_no: true, id: true, receivable_balance: true, total_amount: true },
        take: 5000,
      }),
      prisma.receipts.findMany({
        include: { accounts: true, customers: true },
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
        take: 5000,
      }),
    ])

    return NextResponse.json({
      accounts,
      bills: bills.map((bill) => ({
        customerId: bill.customer_id,
        docNo: bill.doc_no,
        id: bill.id,
        receivableBalance: toNumber(bill.receivable_balance),
        totalAmount: toNumber(bill.total_amount),
      })),
      customers,
      rows: receipts.map((receipt) => ({
        accountId: receipt.account_id ?? '',
        accountName: receipt.accounts?.name ?? '-',
        amount: toNumber(receipt.amount),
        billId: receipt.bill_id ?? '',
        customerId: receipt.customer_id ?? '',
        customerName: receipt.customers?.name ?? receipt.customer_id ?? '-',
        date: toDateOnly(receipt.date),
        docNo: receipt.doc_no,
        fee: toNumber(receipt.fee ?? receipt.bank_fee),
        id: receipt.id,
        method: receipt.method ?? '',
        netAmount: toNumber(receipt.net_amount),
        notes: receipt.notes ?? '',
        partyName: receipt.customers?.name ?? receipt.customer_id ?? '-',
        withholdingTax: toNumber(receipt.withholding_tax),
      })),
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดรายการรับเงิน Customer ไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const values = customerReceiptFormSchema.parse(await request.json())
    const id = values.id ?? `RCP-${randomUUID()}`
    const docNo = values.docNo ?? await nextDailyDocNo('receipts', 'RCP', values.date)
    const actor = currentActor(context)
    const netAmount = values.amount - values.fee - values.withholdingTax - values.discount

    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.receipts.upsert({
        where: { id },
        create: {
          account_id: values.accountId,
          amount: values.amount,
          bank_fee: values.fee,
          bill_id: values.billId,
          created_by: actor,
          customer_id: values.customerId,
          date: normalizeDate(values.date),
          discount: values.discount,
          doc_no: docNo,
          fee: values.fee,
          id,
          method: values.method,
          net_amount: netAmount,
          notes: values.notes,
          status: 'active',
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
          customer_id: values.customerId,
          date: normalizeDate(values.date),
          discount: values.discount,
          doc_no: docNo,
          fee: values.fee,
          method: values.method,
          net_amount: netAmount,
          notes: values.notes,
          updated_at: new Date(),
          updated_by: actor,
          voucher_id: id,
          withholding_tax: values.withholdingTax,
        },
      })

      await tx.bank_statement.deleteMany({ where: { ref_id: id, ref_type: 'RCP' } })
      await tx.bank_statement.create({
        data: {
          account_id: values.accountId,
          amount_in: netAmount,
          amount_out: 0,
          created_by: actor,
          date: normalizeDate(values.date),
          description: `${docNo} - รับเงิน Customer`,
          id: `BS-RCP-${id}`,
          ref_id: id,
          ref_no: docNo,
          ref_type: 'RCP',
          type: 'รับเงิน Customer',
        },
      })

      return receipt
    })

    return NextResponse.json({ id: result.id })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'บันทึกรับเงิน Customer ไม่ได้', 400)
  }
}
