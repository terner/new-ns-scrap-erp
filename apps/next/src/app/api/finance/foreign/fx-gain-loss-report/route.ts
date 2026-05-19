import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { normalizeDate, toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

type FxGainLossRow = Awaited<ReturnType<typeof prisma.fx_gain_loss.findMany>>[number]

function isOpaqueReference(value: string | null | undefined) {
  if (!value) return true
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) || value.length > 40
}

function mapRow(row: FxGainLossRow, referenceBySource: Map<string, string>) {
  const foreignAmount = toNumber(row.amount_fc)
  const originalFxRate = toNumber(row.rate_book)
  const settlementFxRate = toNumber(row.rate_settlement)
  const gainLossAmount = toNumber(row.gain_loss)
  const sourceKey = row.ref_type && row.ref_id ? `${row.ref_type}:${row.ref_id}` : ''
  const referenceNo = sourceKey ? referenceBySource.get(sourceKey) : null
  return {
    currency: (row.currency || '').toUpperCase(),
    date: toDateOnly(row.date),
    foreignAmount,
    fxGainLossAmount: gainLossAmount,
    gainLossType: gainLossAmount > 0 ? 'gain' : gainLossAmount < 0 ? 'loss' : 'neutral',
    id: row.id,
    notes: row.notes ?? '',
    originalFxRate,
    originalThbValue: foreignAmount * originalFxRate,
    reference: referenceNo || (isOpaqueReference(row.ref_id) ? row.ref_type || '-' : row.ref_id),
    referenceNo,
    sourceRefId: row.ref_id,
    settlementFxRate,
    settlementThbValue: foreignAmount * settlementFxRate,
    transactionType: row.ref_type || 'FX Gain/Loss',
  }
}

export async function GET(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const url = new URL(request.url)
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const currency = url.searchParams.get('currency')?.trim().toUpperCase()
    const refType = url.searchParams.get('refType')?.trim()

    const rows = await prisma.fx_gain_loss.findMany({
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }, { id: 'desc' }],
      take: 5000,
      where: {
        ...(currency && currency !== 'ALL' ? { currency } : {}),
        ...(refType && refType !== 'all' ? { ref_type: refType } : {}),
        ...(from || to ? {
          date: {
            ...(from ? { gte: normalizeDate(from) } : {}),
            ...(to ? { lte: normalizeDate(to) } : {}),
          },
        } : {}),
      },
    })

    const sourcePairs = rows
      .filter((row) => row.ref_type && row.ref_id)
      .map((row) => ({ refId: row.ref_id as string, refType: row.ref_type as string }))
    const statements = sourcePairs.length > 0 ? await prisma.bank_statement.findMany({
      select: { ref_id: true, ref_no: true, ref_type: true },
      where: {
        OR: sourcePairs.map((pair) => ({ ref_id: pair.refId, ref_type: pair.refType })),
      },
    }) : []
    const referenceBySource = new Map(statements.filter((row) => row.ref_id && row.ref_no && row.ref_type).map((row) => [`${row.ref_type}:${row.ref_id}`, row.ref_no as string]))

    const mappedRows = rows.map((row) => mapRow(row, referenceBySource))
    const totalGain = mappedRows.filter((row) => row.fxGainLossAmount >= 0).reduce((sum, row) => sum + row.fxGainLossAmount, 0)
    const totalLoss = mappedRows.filter((row) => row.fxGainLossAmount < 0).reduce((sum, row) => sum + Math.abs(row.fxGainLossAmount), 0)

    return NextResponse.json({
      filters: {
        currencies: Array.from(new Set(mappedRows.map((row) => row.currency).filter(Boolean))).sort(),
        refTypes: Array.from(new Set(mappedRows.map((row) => row.transactionType).filter(Boolean))).sort(),
      },
      rows: mappedRows,
      schemaState: {
        referenceResolution: 'bank_statement.ref_no when matched, otherwise ref_type or non-opaque ref_id',
        realizedOnly: true,
        sourceTable: 'fx_gain_loss',
        unrealizedSource: 'not_available',
        writeBehavior: 'read_only_no_auto_post',
      },
      summary: {
        net: totalGain - totalLoss,
        rows: mappedRows.length,
        totalGain,
        totalLoss,
      },
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลด FX Gain/Loss ไม่ได้', 500)
  }
}
