import { randomUUID } from 'node:crypto'
import { Prisma } from '../../../generated/prisma/client'
import { toNumber } from '@/lib/server/daily'

type DbClient = Prisma.TransactionClient

export const PO_SELL_ALLOCATION_ACTION = {
  ALLOCATED_TO_SALES_BILL: 'allocated_to_sales_bill',
  RELEASED_FROM_SALES_BILL: 'released_from_sales_bill',
} as const

export type PoSellAllocationAction = typeof PO_SELL_ALLOCATION_ACTION[keyof typeof PO_SELL_ALLOCATION_ACTION]

export type PoSellAllocationLogEntry = {
  action: PoSellAllocationAction
  actor?: string | null
  allocatedAmount: number
  allocatedQty: number
  createdAt?: Date
  meta?: Prisma.InputJsonValue
  note?: string | null
  poSellId: bigint
  productCodeSnapshot?: string | null
  productId?: bigint | null
  productNameSnapshot?: string | null
  salesBillDocNo?: string | null
  salesBillId?: bigint | null
  salesBillLineId?: bigint | null
  salesBillLineNo?: number | null
  unitPriceSnapshot?: number | null
}

const EPSILON = 0.0001

function isReleaseAction(action: PoSellAllocationAction) {
  return action === PO_SELL_ALLOCATION_ACTION.RELEASED_FROM_SALES_BILL
}

export async function appendPoSellAllocationLogs(
  tx: DbClient,
  entries: PoSellAllocationLogEntry[],
) {
  const materialEntries = entries.filter((entry) => Math.abs(entry.allocatedQty) > EPSILON || Math.abs(entry.allocatedAmount) > EPSILON)
  if (materialEntries.length === 0) return

  const poSellIds = [...new Set(materialEntries.map((entry) => entry.poSellId))]
  const poSells = await tx.po_sells.findMany({
    select: {
      doc_no: true,
      id: true,
      remaining_qty: true,
    },
    where: { id: { in: poSellIds } },
  })
  const poSellById = new Map(poSells.map((poSell) => [poSell.id, poSell]))
  const runningRemainingByPoSellId = new Map(poSells.map((poSell) => [poSell.id, toNumber(poSell.remaining_qty)] as const))

  const rows = materialEntries.map((entry) => {
    const poSell = poSellById.get(entry.poSellId)
    if (!poSell) {
      throw new Error(`ไม่พบ PO Sell สำหรับบันทึก allocation log: ${String(entry.poSellId)}`)
    }

    const fromRemainingQty = runningRemainingByPoSellId.get(entry.poSellId) ?? 0
    const toRemainingQty = isReleaseAction(entry.action)
      ? fromRemainingQty + entry.allocatedQty
      : Math.max(0, fromRemainingQty - entry.allocatedQty)
    runningRemainingByPoSellId.set(entry.poSellId, toRemainingQty)

    return {
      action: entry.action,
      allocated_amount: entry.allocatedAmount,
      allocated_qty: entry.allocatedQty,
      created_at: entry.createdAt ?? new Date(),
      created_by: entry.actor ?? null,
      event_key: `POSALLOC-${poSell.doc_no}-${randomUUID()}`,
      from_remaining_qty: fromRemainingQty,
      meta: entry.meta,
      note: entry.note ?? null,
      po_sell_doc_no: poSell.doc_no,
      po_sell_id: entry.poSellId,
      product_code_snapshot: entry.productCodeSnapshot ?? null,
      product_id: entry.productId ?? null,
      product_name_snapshot: entry.productNameSnapshot ?? null,
      sales_bill_doc_no: entry.salesBillDocNo ?? null,
      sales_bill_id: entry.salesBillId ?? null,
      sales_bill_line_id: entry.salesBillLineId ?? null,
      sales_bill_line_no: entry.salesBillLineNo ?? null,
      to_remaining_qty: toRemainingQty,
      unit_price_snapshot: entry.unitPriceSnapshot ?? 0,
    }
  })

  await tx.po_sell_allocation_logs.createMany({ data: rows })
}
