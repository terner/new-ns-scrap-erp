import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { prisma } from '@/lib/server/prisma'
import { toNumber } from '@/lib/server/master-data'

export const runtime = 'nodejs'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10000).default(5000),
})

function toDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null
}

export async function GET(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const url = new URL(request.url)
    const values = querySchema.parse({
      limit: url.searchParams.get('limit') ?? undefined,
    })

    const [accounts, movements] = await Promise.all([
      prisma.accounts.findMany({
        orderBy: [{ active: 'desc' }, { code: 'asc' }, { name: 'asc' }],
      }),
      prisma.bank_statement.findMany({
        include: { accounts: true },
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
        take: values.limit,
      }),
    ])

    const movementTotals = new Map<string, number>()
    for (const row of movements) {
      if (!row.account_id) continue
      movementTotals.set(row.account_id, (movementTotals.get(row.account_id) ?? 0) + (toNumber(row.amount_in) ?? 0) - (toNumber(row.amount_out) ?? 0))
    }

    return NextResponse.json({
      accounts: accounts.map((account) => {
        const openingBalance = toNumber(account.opening_balance) ?? 0
        return {
          accountNo: account.account_no,
          active: account.active ?? true,
          balance: openingBalance + (movementTotals.get(account.id) ?? 0),
          code: account.code ?? account.id,
          currency: account.currency ?? 'THB',
          id: account.id,
          name: account.name,
          odLimit: toNumber(account.od_limit) ?? 0,
          openingBalance,
          type: account.type,
        }
      }),
      rows: movements.map((row) => ({
        accountId: row.account_id,
        accountName: row.accounts?.name ?? row.account_id ?? '-',
        amountIn: toNumber(row.amount_in) ?? 0,
        amountOut: toNumber(row.amount_out) ?? 0,
        date: toDate(row.date) ?? '',
        description: row.description ?? row.desc ?? row.note ?? '',
        id: row.id,
        note: row.note ?? '',
        payee: '',
        refId: row.ref_id,
        refNo: row.ref_no ?? row.id,
        refType: row.ref_type ?? row.type ?? 'BANK',
      })),
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลด Transaction Ledger ไม่สำเร็จ', 500)
  }
}
