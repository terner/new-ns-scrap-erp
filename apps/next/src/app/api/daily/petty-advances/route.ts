import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { pettyAdvanceFormSchema } from '@/lib/daily'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { currentActor, listDailyAccounts, nextDailyDocNo, normalizeDate, toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'
import type { Prisma } from '../../../../../generated/prisma/client'

export const runtime = 'nodejs'

type PettyAdvanceWithRelations = Prisma.petty_advancesGetPayload<{
  include: {
    accounts: true
    petty_advance_returns: {
      include: {
        accounts: true
      }
    }
  }
}>

function advanceJson(row: PettyAdvanceWithRelations) {
  const returned = toNumber(row.returned_amount)
  const spent = 0
  const amount = toNumber(row.amount)

  return {
    accountId: row.account_id ?? '',
    accountName: row.accounts?.name ?? '-',
    amount,
    date: toDateOnly(row.date),
    docNo: row.doc_no,
    id: row.id,
    notes: row.notes ?? '',
    recipientName: row.recipient_name,
    remaining: amount - spent - returned,
    returned,
    returns: row.petty_advance_returns?.map((entry) => ({
      accountId: entry.account_id ?? '',
      accountName: entry.accounts?.name ?? '-',
      amount: toNumber(entry.amount),
      date: toDateOnly(entry.date),
      id: entry.id,
      notes: entry.notes ?? '',
    })) ?? [],
    spent,
    status: row.status,
    type: row.type,
  }
}

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const [accounts, rows] = await Promise.all([
      listDailyAccounts(),
      prisma.petty_advances.findMany({
        include: {
          accounts: true,
          petty_advance_returns: {
            include: { accounts: true },
            orderBy: [{ date: 'desc' }],
          },
        },
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
        take: 5000,
      }),
    ])

    return NextResponse.json({ accounts, rows: rows.map(advanceJson) })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดเงินสำรองจ่ายไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const values = pettyAdvanceFormSchema.parse(await request.json())
    const id = values.id ?? `PADV-${randomUUID()}`
    const docNo = values.docNo ?? await nextDailyDocNo('petty_advances', 'PADV', values.date)
    const actor = currentActor(context)

    const result = await prisma.$transaction(async (tx) => {
      const advance = await tx.petty_advances.upsert({
        where: { id },
        create: {
          account_id: values.accountId,
          amount: values.amount,
          created_by: actor,
          date: normalizeDate(values.date),
          doc_no: docNo,
          id,
          notes: values.notes,
          recipient_name: values.recipientName,
          status: values.status,
          type: values.type,
          updated_at: new Date(),
          updated_by: actor,
        },
        update: {
          account_id: values.accountId,
          amount: values.amount,
          date: normalizeDate(values.date),
          doc_no: docNo,
          notes: values.notes,
          recipient_name: values.recipientName,
          status: values.status,
          type: values.type,
          updated_at: new Date(),
          updated_by: actor,
        },
      })

      await tx.bank_statement.deleteMany({
        where: {
          ref_id: id,
          ref_type: 'PADV',
        },
      })
      await tx.bank_statement.create({
        data: {
          account_id: values.accountId,
          amount_in: 0,
          amount_out: values.amount,
          created_by: actor,
          date: normalizeDate(values.date),
          description: `${docNo} - ${values.recipientName}${values.notes ? ` (${values.notes})` : ''}`,
          id: `BS-PADV-${id}`,
          ref_id: id,
          ref_no: docNo,
          ref_type: 'PADV',
          type: values.type === 'DIRECTOR_LOAN' ? 'กู้กรรมการ' : 'เงินสำรองจ่าย',
        },
      })

      return advance
    })

    return NextResponse.json({ id: result.id })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'บันทึกเงินสำรองจ่ายไม่ได้', 400)
  }
}
