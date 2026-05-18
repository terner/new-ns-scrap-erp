import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { pettyAdvanceReturnFormSchema } from '@/lib/daily'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { currentActor, normalizeDate, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const values = pettyAdvanceReturnFormSchema.parse(await request.json())
    const id = `PRET-${randomUUID()}`
    const actor = currentActor(context)

    const result = await prisma.$transaction(async (tx) => {
      const advance = await tx.petty_advances.findUnique({
        where: { id: values.advanceId },
      })

      if (!advance) {
        return null
      }

      const entry = await tx.petty_advance_returns.create({
        data: {
          account_id: values.accountId,
          advance_id: values.advanceId,
          amount: values.amount,
          created_by: actor,
          date: normalizeDate(values.date),
          id,
          notes: values.notes,
        },
      })

      const returnedAmount = toNumber(advance.returned_amount) + values.amount
      const status = returnedAmount >= toNumber(advance.amount) ? 'closed' : advance.status
      await tx.petty_advances.update({
        data: {
          closed_at: status === 'closed' ? new Date() : advance.closed_at,
          returned_amount: returnedAmount,
          status,
          updated_at: new Date(),
          updated_by: actor,
        },
        where: { id: values.advanceId },
      })

      await tx.bank_statement.create({
        data: {
          account_id: values.accountId,
          amount_in: values.amount,
          amount_out: 0,
          created_by: actor,
          date: normalizeDate(values.date),
          description: `คืน ${advance.doc_no} โดย ${advance.recipient_name}`,
          id: `BS-PRET-${id}`,
          ref_id: id,
          ref_no: advance.doc_no,
          ref_type: 'PRET',
          type: 'คืนเงินสำรองจ่าย',
        },
      })

      return entry
    })

    if (!result) {
      return NextResponse.json({ code: 'NOT_FOUND', error: 'ไม่พบรายการเงินสำรอง' }, { status: 404 })
    }

    return NextResponse.json({ id: result.id })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'บันทึกคืนเงินสำรองจ่ายไม่ได้', 400)
  }
}
