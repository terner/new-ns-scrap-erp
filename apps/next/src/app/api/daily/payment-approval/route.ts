import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import type { Prisma } from '../../../../../generated/prisma/client'
import { z } from 'zod'
import { defaultPaymentMethodNameByGroup, resolvePaymentMethodName } from '@/lib/account-payment-method'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { normalizeDate, toDateOnly, toNumber } from '@/lib/server/daily'
import { getActivePaymentMethods, type ActivePaymentMethod } from '@/lib/server/payment-methods'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

const approvalRequestSchema = z.object({
  items: z.array(z.object({
    approvedAmount: z.coerce.number().finite().gt(0, 'ยอดอนุมัติต้องมากกว่า 0'),
    bankAccountId: z.string().trim().min(1, 'เลือกบัญชีปลายทาง'),
    sourceId: z.string().trim().min(1, 'ไม่พบเอกสารที่ต้องการอนุมัติ'),
    sourceType: z.enum(['purchase_bill', 'expense']),
  })).min(1, 'เลือกอย่างน้อย 1 รายการ'),
})

function normalizeSupplierBankAccounts(params: {
  fallbackAccountNo: string | null | undefined
  fallbackBankName: string | null | undefined
  paymentMethods: ActivePaymentMethod[]
  rows:
    | Array<{
        account_no: string | null
        active: boolean | null
        bank_name: string | null
        id: string
        is_primary: boolean | null
        payment_method: string | null
      }>
    | null
    | undefined
}) {
  const defaultBankMethod = defaultPaymentMethodNameByGroup(params.paymentMethods, 'bank') ?? ''
  const options = (params.rows ?? [])
    .filter((account) => account.active !== false)
    .map((account) => ({
      accountNo: account.account_no ?? '',
      bankName: account.bank_name ?? '',
      id: account.id,
      isPrimary: account.is_primary ?? false,
      paymentMethod: resolvePaymentMethodName(account.payment_method, params.paymentMethods) ?? defaultBankMethod,
    }))

  const fallbackAccountNo = String(params.fallbackAccountNo ?? '').trim()
  const fallbackBankName = String(params.fallbackBankName ?? '').trim()
  if (fallbackAccountNo || fallbackBankName) {
    const hasFallback = options.some((account) => (
      account.accountNo.trim() === fallbackAccountNo && account.bankName.trim() === fallbackBankName
    ))
    if (!hasFallback) {
      options.unshift({
        accountNo: fallbackAccountNo,
        bankName: fallbackBankName,
        id: `legacy:${fallbackBankName}:${fallbackAccountNo}`,
        isPrimary: options.length === 0,
        paymentMethod: defaultBankMethod,
      })
    }
  }

  return options
}

function normalizeBranchCode(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim()
  return trimmed ? trimmed.padStart(2, '0').slice(-2) : '00'
}

async function nextPaymentApprovalDocNo(
  tx: { $queryRaw: <T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => Promise<T> },
  approvedDate: Date,
  branchCode: string,
) {
  const period = toDateOnly(approvedDate).slice(2, 4) + toDateOnly(approvedDate).slice(5, 7)
  const normalizedBranchCode = normalizeBranchCode(branchCode)
  const startsWith = `PMA${normalizedBranchCode}${period}-`
  const rows = await tx.$queryRaw<Array<{ doc_no: string }>>`
    select doc_no
    from public.payment_approvals
    where doc_no like ${`${startsWith}%`}
  `
  const lastNumber = rows.reduce((max: number, row: { doc_no: string }) => {
    const running = Number(String(row.doc_no).split('-').at(-1))
    return Number.isFinite(running) && running > max ? running : max
  }, 0)
  return `${startsWith}${String(lastNumber + 1).padStart(4, '0')}`
}

export async function GET() {
  try {
    const prismaExt = prisma as typeof prisma & {
      payment_approvals: {
        findMany: (args: unknown) => Promise<Array<{
          approved_amount: unknown
          approved_at: Date | null
          created_at: Date | null
          destination_account_no_snapshot: string | null
          destination_bank_name_snapshot: string | null
          id: string
          party_name_snapshot: string | null
          source_id: string
          source_type: string
          status: string
        }>>
      }
    }
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const [purchaseBills, expenses, approvals, paymentMethods] = await Promise.all([
      prisma.purchase_bills.findMany({
        include: {
          suppliers: {
            include: {
              supplier_bank_accounts: {
                orderBy: [{ is_primary: 'desc' }, { id: 'asc' }],
              },
            },
          },
        },
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
      prismaExt.payment_approvals.findMany({
        orderBy: [{ approved_at: 'desc' }, { created_at: 'desc' }],
        take: 5000,
        where: {
          status: 'approved',
        },
      }),
      getActivePaymentMethods(),
    ])

    const approvalByPurchaseBillId = new Map<string, typeof approvals[number][]>()
    const approvalByExpenseId = new Map<string, typeof approvals[number][]>()
    for (const approval of approvals) {
      if (approval.source_type === 'purchase_bill') {
        approvalByPurchaseBillId.set(approval.source_id, [...(approvalByPurchaseBillId.get(approval.source_id) ?? []), approval])
      }
      if (approval.source_type === 'expense') {
        approvalByExpenseId.set(approval.source_id, [...(approvalByExpenseId.get(approval.source_id) ?? []), approval])
      }
    }

    const apRows = purchaseBills.flatMap((bill: typeof purchaseBills[number]) => {
      const activeApprovals = approvalByPurchaseBillId.get(bill.id) ?? []
        const totalAmount = toNumber(bill.total_amount)
        const paidAmount = toNumber(bill.paid_amount)
        const payableBalance = Math.max(0, toNumber(bill.payable_balance) || totalAmount - paidAmount)
        const bankAccounts = normalizeSupplierBankAccounts({
          fallbackAccountNo: bill.suppliers?.bank_account,
          fallbackBankName: bill.suppliers?.bank_name,
          paymentMethods,
          rows: bill.suppliers?.supplier_bank_accounts,
        })
        const approvedOutstanding = activeApprovals.reduce((sum, approval) => sum + toNumber(approval.approved_amount), 0)
        const pendingAmount = Math.max(0, payableBalance - approvedOutstanding)
        const pendingRows = pendingAmount > 0.01 ? [{
          bankAccount: bill.suppliers?.bank_account ?? '',
          bankAccounts,
          approvalId: null,
          approvalStatus: 'pending' as const,
          approvedAmount: 0,
          bankName: bill.suppliers?.bank_name ?? '',
          date: toDateOnly(bill.date),
          docNo: bill.doc_no,
          id: bill.id,
          paidAmount,
          payableBalance: pendingAmount,
          supplierName: bill.suppliers?.name ?? bill.supplier_id ?? '-',
          totalAmount,
        }] : []
        const approvedRows = activeApprovals.map((approval) => ({
          bankAccount: approval.destination_account_no_snapshot ?? '',
          bankAccounts: [],
          approvalId: approval.id,
          approvalStatus: 'approved' as const,
          approvedAmount: toNumber(approval.approved_amount),
          bankName: approval.destination_bank_name_snapshot ?? '',
          date: toDateOnly(approval.approved_at ?? bill.date),
          docNo: bill.doc_no,
          id: `${bill.id}:${approval.id}`,
          paidAmount,
          payableBalance: toNumber(approval.approved_amount),
          supplierName: approval.party_name_snapshot ?? bill.suppliers?.name ?? bill.supplier_id ?? '-',
          totalAmount,
        }))
        return [...pendingRows, ...approvedRows]
      })

    const expenseRows = expenses.flatMap((expense: typeof expenses[number]) => {
      const amount = toNumber(expense.net_amount) || toNumber(expense.amount) + toNumber(expense.vat) - toNumber(expense.wht)
      const activeApprovals = approvalByExpenseId.get(expense.id) ?? []
      const approvedOutstanding = activeApprovals.reduce((sum, approval) => sum + toNumber(approval.approved_amount), 0)
      const pendingAmount = Math.max(0, amount - approvedOutstanding)
      const pendingRows = pendingAmount > 0.01 ? [{
        accountName: expense.accounts?.name ?? '',
        approvalId: null,
        approvalStatus: 'pending' as const,
        approvedAmount: 0,
        date: toDateOnly(expense.date),
        docNo: expense.doc_no,
        dueDate: toDateOnly(expense.due_date),
        id: expense.id,
        payee: expense.payee ?? '-',
        refDocNo: expense.ref_doc_no ?? '',
        totalAmount: pendingAmount,
      }] : []
      const approvedRows = activeApprovals.map((approval) => ({
        accountName: approval.destination_bank_name_snapshot || approval.destination_payment_method_snapshot || '',
        approvalId: approval.id,
        approvalStatus: 'approved' as const,
        approvedAmount: toNumber(approval.approved_amount),
        date: toDateOnly(approval.approved_at ?? expense.date),
        docNo: expense.doc_no,
        dueDate: toDateOnly(expense.due_date),
        id: `${expense.id}:${approval.id}`,
        payee: approval.party_name_snapshot ?? expense.payee ?? '-',
        refDocNo: expense.ref_doc_no ?? '',
        totalAmount: toNumber(approval.approved_amount),
      }))
      return [...pendingRows, ...approvedRows]
    })

    return NextResponse.json({ apRows, expenseRows })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดรายการอนุมัติโอนเงินไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const values = approvalRequestSchema.parse(await request.json())
    const actor = context.appUser?.id || context.authUser.id
    const paymentMethods = await getActivePaymentMethods()

    const purchaseBillItems = values.items.filter((item) => item.sourceType === 'purchase_bill')
    const expenseItems = values.items.filter((item) => item.sourceType === 'expense')
    if (expenseItems.length > 0) {
      throw new Error('ค่าใช้จ่ายยังไม่เปิด approval write flow ในรอบนี้')
    }

    const result = await prisma.$transaction(async (tx) => {
      const txExt = tx as typeof tx & {
        payment_approvals: {
          create: (args: unknown) => Promise<{ id: string }>
          findMany: (args: unknown) => Promise<Array<{ approved_amount: unknown; source_id: string }>>
        }
      }
      const purchaseBillIds = [...new Set(purchaseBillItems.map((item) => item.sourceId))]
      const bills = await tx.purchase_bills.findMany({
        include: {
          branches: true,
          suppliers: {
            include: {
              supplier_bank_accounts: true,
            },
          },
        },
        where: {
          id: { in: purchaseBillIds },
          NOT: { status: 'cancelled' },
        },
      })
      if (bills.length !== purchaseBillIds.length) throw new Error('ไม่พบบิลซื้อบางรายการ หรือบิลถูกยกเลิกแล้ว')

      const billById = new Map(bills.map((bill) => [bill.id, bill]))
      const existingApprovals = await txExt.payment_approvals.findMany({
        where: {
          source_id: { in: purchaseBillIds },
          source_type: 'purchase_bill',
          status: 'approved',
        },
      })
      const approvedAmountByBillId = new Map<string, number>()
      for (const approval of existingApprovals) {
        approvedAmountByBillId.set(approval.source_id, (approvedAmountByBillId.get(approval.source_id) ?? 0) + toNumber(approval.approved_amount))
      }

      const created = []
      for (const item of purchaseBillItems) {
        const bill = billById.get(item.sourceId)
        if (!bill) throw new Error('ไม่พบบิลซื้อที่ต้องการอนุมัติ')
        const totalAmount = toNumber(bill.total_amount)
        const paidAmount = toNumber(bill.paid_amount)
        const payableBalance = Math.max(0, toNumber(bill.payable_balance) || totalAmount - paidAmount)
        const alreadyApproved = approvedAmountByBillId.get(bill.id) ?? 0
        const pendingAmount = Math.max(0, payableBalance - alreadyApproved)
        if (item.approvedAmount - pendingAmount > 0.01) {
          throw new Error(`ยอดอนุมัติของ ${bill.doc_no} เกินยอดคงเหลือที่ยังไม่ได้อนุมัติ`)
        }

        const bankAccounts = normalizeSupplierBankAccounts({
          fallbackAccountNo: bill.suppliers?.bank_account,
          fallbackBankName: bill.suppliers?.bank_name,
          paymentMethods,
          rows: bill.suppliers?.supplier_bank_accounts,
        })
        const selectedBank = bankAccounts.find((account) => account.id === item.bankAccountId)
        if (!selectedBank) throw new Error(`ไม่พบบัญชีปลายทางของ ${bill.doc_no}`)
        const approvedAt = new Date()
        const docNo = await nextPaymentApprovalDocNo(tx, approvedAt, bill.branches?.code ?? '')

        const approval = await txExt.payment_approvals.create({
          data: {
            approved_amount: item.approvedAmount,
            approved_at: approvedAt,
            approved_by: actor,
            destination_account_no_snapshot: selectedBank.accountNo || null,
            destination_bank_account_id_snapshot: selectedBank.id,
            destination_bank_name_snapshot: selectedBank.bankName || null,
            destination_payment_method_snapshot: selectedBank.paymentMethod || null,
            doc_no: docNo,
            id: `PMA-${randomUUID()}`,
            party_id: bill.supplier_id,
            party_name_snapshot: bill.suppliers?.name ?? bill.supplier_id ?? null,
            source_date_snapshot: bill.date ? normalizeDate(toDateOnly(bill.date)) : null,
            source_doc_no_snapshot: bill.doc_no,
            source_id: bill.id,
            source_type: 'purchase_bill',
            status: 'approved',
          },
        })
        created.push(approval)
      }

      return created
    })

    return NextResponse.json({ items: result })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'อนุมัติโอนเงินไม่ได้', 400)
  }
}
