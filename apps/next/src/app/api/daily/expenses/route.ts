import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { expenseFormSchema } from '@/lib/daily'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { currentActor, listDailyAccounts, nextDailyDocNo, normalizeDate, toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'
import type { Prisma } from '../../../../../generated/prisma/client'

export const runtime = 'nodejs'

type ExpenseWithRelations = Prisma.expensesGetPayload<{
  include: {
    accounts: true
    expense_categories: true
  }
}>

function expenseJson(row: ExpenseWithRelations) {
  return {
    accountId: row.account_id ?? '',
    accountName: row.accounts?.name ?? '-',
    amount: toNumber(row.amount),
    branchId: row.branch_id ?? '',
    categoryId: row.category_id ?? '',
    categoryName: row.expense_categories?.name ?? '-',
    date: toDateOnly(row.date),
    description: row.description ?? '',
    docNo: row.doc_no,
    dueDate: toDateOnly(row.due_date),
    id: row.id,
    netAmount: toNumber(row.net_amount),
    notes: row.notes ?? '',
    paidStatus: row.paid_status ?? 'pending',
    payee: row.payee ?? '',
    refDocNo: row.ref_doc_no ?? '',
    status: row.status ?? 'pending',
    taxInvoiceNo: row.tax_invoice_no ?? '',
    vat: toNumber(row.vat ?? row.vat_amount),
    wht: toNumber(row.wht ?? row.wht_amount),
  }
}

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const [accounts, categories, rows] = await Promise.all([
      listDailyAccounts(),
      prisma.expense_categories.findMany({
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
        select: { active: true, id: true, name: true },
      }),
      prisma.expenses.findMany({
        include: {
          accounts: true,
          expense_categories: true,
        },
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
        take: 5000,
      }),
    ])

    return NextResponse.json({ accounts, categories, rows: rows.map(expenseJson) })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดรายการค่าใช้จ่ายไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const values = expenseFormSchema.parse(await request.json())
    const id = values.id ?? `EXP-${randomUUID()}`
    const docNo = values.docNo ?? await nextDailyDocNo('expenses', 'EXP', values.date)
    const actor = currentActor(context)
    const netAmount = values.amount + values.vat - values.wht

    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expenses.upsert({
        where: { id },
        create: {
          account_id: values.accountId,
          amount: values.amount,
          branch_id: values.branchId,
          category_id: values.categoryId,
          created_by: actor,
          date: normalizeDate(values.date),
          description: values.description,
          doc_no: docNo,
          due_date: values.dueDate ? normalizeDate(values.dueDate) : null,
          id,
          net_amount: netAmount,
          notes: values.notes,
          paid_at: values.paidStatus === 'paid' ? new Date() : null,
          paid_status: values.paidStatus,
          payee: values.payee,
          ref_doc_no: values.refDocNo,
          status: values.paidStatus === 'paid' ? 'paid' : 'pending',
          tax_invoice_no: values.taxInvoiceNo,
          updated_at: new Date(),
          updated_by: actor,
          vat: values.vat,
          vat_amount: values.vat,
          voucher_id: id,
          wht: values.wht,
          wht_amount: values.wht,
        },
        update: {
          account_id: values.accountId,
          amount: values.amount,
          branch_id: values.branchId,
          category_id: values.categoryId,
          date: normalizeDate(values.date),
          description: values.description,
          doc_no: docNo,
          due_date: values.dueDate ? normalizeDate(values.dueDate) : null,
          net_amount: netAmount,
          notes: values.notes,
          paid_at: values.paidStatus === 'paid' ? new Date() : null,
          paid_status: values.paidStatus,
          payee: values.payee,
          ref_doc_no: values.refDocNo,
          status: values.paidStatus === 'paid' ? 'paid' : 'pending',
          tax_invoice_no: values.taxInvoiceNo,
          updated_at: new Date(),
          updated_by: actor,
          vat: values.vat,
          vat_amount: values.vat,
          voucher_id: id,
          wht: values.wht,
          wht_amount: values.wht,
        },
      })

      await tx.bank_statement.deleteMany({
        where: {
          ref_id: id,
          ref_type: 'EXP',
        },
      })

      if (values.paidStatus === 'paid' && values.accountId) {
        await tx.bank_statement.create({
          data: {
            account_id: values.accountId,
            amount_in: 0,
            amount_out: netAmount,
            created_by: actor,
            date: normalizeDate(values.date),
            description: `${docNo} - ${values.payee}`,
            id: `BS-EXP-${id}`,
            ref_id: id,
            ref_no: docNo,
            ref_type: 'EXP',
            type: 'จ่ายค่าใช้จ่าย',
          },
        })
      }

      return expense
    })

    return NextResponse.json({ id: result.id })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'บันทึกรายการค่าใช้จ่ายไม่ได้', 400)
  }
}
