import { toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export type SalesBillAnalyticsLine = {
  lineAmount: number
  productId: bigint | null
  productName: string
  qty: number
  salesBillId: bigint
}

export async function salesBillAnalyticsLinesByBillId(billIds: bigint[]) {
  if (!billIds.length) return new Map<bigint, SalesBillAnalyticsLine[]>()

  const rows = await prisma.sales_bill_lines.findMany({
    select: {
      line_amount: true,
      product_id: true,
      product_name_snapshot: true,
      qty: true,
      sales_bill_id: true,
    },
    where: { sales_bill_id: { in: billIds }, status: 'active' },
    orderBy: [{ sales_bill_id: 'asc' }, { line_no: 'asc' }],
  })
  const linesByBillId = new Map<bigint, SalesBillAnalyticsLine[]>()
  for (const row of rows) {
    const current = linesByBillId.get(row.sales_bill_id) ?? []
    current.push({
      lineAmount: toNumber(row.line_amount),
      productId: row.product_id,
      productName: row.product_name_snapshot,
      qty: toNumber(row.qty),
      salesBillId: row.sales_bill_id,
    })
    linesByBillId.set(row.sales_bill_id, current)
  }
  return linesByBillId
}

export function salesBillAnalyticsLineTotals(lines: SalesBillAnalyticsLine[] | undefined) {
  return (lines ?? []).reduce((sum, line) => ({
    amount: sum.amount + line.lineAmount,
    qty: sum.qty + line.qty,
  }), { amount: 0, qty: 0 })
}
