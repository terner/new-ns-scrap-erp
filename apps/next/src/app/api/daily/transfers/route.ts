import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { transferFormSchema } from '@/lib/daily'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { bankStatementTransferRows, currentActor, listDailyAccounts, nextDailyDocNo, normalizeDate, toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'
import type { Prisma } from '../../../../../generated/prisma/client'

export const runtime = 'nodejs'

type TransferWithAccounts = Prisma.transfersGetPayload<{
  include: {
    accounts_transfers_from_account_idToaccounts: true
    accounts_transfers_to_account_idToaccounts: true
  }
}>

function transferJson(row: TransferWithAccounts) {
  return {
    amount: toNumber(row.amount),
    byPerson: row.created_by ?? '',
    date: toDateOnly(row.date),
    docNo: row.doc_no,
    fee: toNumber(row.fee ?? row.bank_fee),
    fromAccountId: row.from_account_id ?? '',
    fromAccountName: row.accounts_transfers_from_account_idToaccounts?.name ?? '-',
    id: row.id,
    notes: row.notes ?? '',
    status: row.status ?? 'active',
    toAccountId: row.to_account_id ?? '',
    toAccountName: row.accounts_transfers_to_account_idToaccounts?.name ?? '-',
  }
}

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const [accounts, rows] = await Promise.all([
      listDailyAccounts(),
      prisma.transfers.findMany({
        include: {
          accounts_transfers_from_account_idToaccounts: true,
          accounts_transfers_to_account_idToaccounts: true,
        },
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
        take: 5000,
      }),
    ])

    return NextResponse.json({ accounts, rows: rows.map(transferJson) })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดรายการโอนเงินไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const values = transferFormSchema.parse(await request.json())
    const id = values.id ?? `TRF-${randomUUID()}`
    const docNo = values.docNo ?? await nextDailyDocNo('transfers', 'TRF', values.date)
    const actor = currentActor(context)

    const [fromAccount, toAccount] = await Promise.all([
      prisma.accounts.findUnique({ where: { id: values.fromAccountId } }),
      prisma.accounts.findUnique({ where: { id: values.toAccountId } }),
    ])

    if (!fromAccount || !toAccount) {
      return NextResponse.json({ code: 'BAD_REQUEST', error: 'ไม่พบบัญชีต้นทางหรือปลายทาง' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.transfers.upsert({
        where: { id },
        create: {
          amount: values.amount,
          bank_fee: values.fee,
          created_by: actor,
          date: normalizeDate(values.date),
          doc_no: docNo,
          fee: values.fee,
          from_account_id: values.fromAccountId,
          id,
          notes: values.notes,
          status: 'active',
          to_account_id: values.toAccountId,
          updated_at: new Date(),
          updated_by: actor,
        },
        update: {
          amount: values.amount,
          bank_fee: values.fee,
          date: normalizeDate(values.date),
          doc_no: docNo,
          fee: values.fee,
          from_account_id: values.fromAccountId,
          notes: values.notes,
          to_account_id: values.toAccountId,
          updated_at: new Date(),
          updated_by: actor,
        },
      })

      await tx.bank_statement.deleteMany({
        where: {
          ref_id: id,
          ref_type: 'TRF',
        },
      })
      await tx.bank_statement.createMany({
        data: bankStatementTransferRows({
          amount: values.amount,
          by: actor,
          date: values.date,
          docNo,
          fee: values.fee,
          fromAccountId: values.fromAccountId,
          fromAccountName: fromAccount.name,
          id,
          toAccountId: values.toAccountId,
          toAccountName: toAccount.name,
        }),
      })

      return transfer
    })

    return NextResponse.json({ id: result.id })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'บันทึกรายการโอนเงินไม่ได้', 400)
  }
}
