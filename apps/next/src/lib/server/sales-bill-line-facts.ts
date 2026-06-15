import { toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'
import type { Prisma } from '../../../generated/prisma/client'

type SalesBillLineWithFacts = Prisma.sales_bill_linesGetPayload<{
  include: {
    products: true
    sales_bill_po_sell_allocations: true
    sales_bill_source_allocations: true
    sales_bills: {
      include: {
        branches: true
        customers: true
        sales_channels: true
        warehouses: true
      }
    }
  }
}>

type TradingAllocationFact = Prisma.trading_allocation_factsGetPayload<Record<string, never>>

export type SalesBillLineFactRow = {
  allocationType: string
  billId: bigint
  branchId: bigint | null
  branchName: string
  channelName: string
  cogs: number
  customerId: bigint | null
  customerName: string
  date: Date
  dateText: string
  discountAmount: number
  docNo: string
  gp: number
  grossWeight: number
  lineAmount: number
  lineNo: number
  lineStatus: string
  matchedCogs: number
  netWeight: number
  poSellDocNo: string
  productCode: string
  productId: bigint | null
  productName: string
  qty: number
  sourceDocNo: string
  sourceType: string
  status: string
  transactionMode: string
  unit: string
  unitPrice: number
  vatAmount: number
  warehouseName: string
}

type SalesBillLineFactOptions = {
  lineStatuses?: string[]
  tradingStatuses?: string[]
}

function lineKey(salesBillId: bigint, lineNo: number) {
  return `${salesBillId.toString()}:${lineNo}`
}

function sumTradingFactsByLine(facts: TradingAllocationFact[]) {
  const totals = new Map<string, number>()
  for (const fact of facts) {
    if (fact.sales_bill_id == null || fact.sales_line_no == null) continue
    const key = lineKey(fact.sales_bill_id, fact.sales_line_no)
    totals.set(key, (totals.get(key) ?? 0) + toNumber(fact.matched_cogs))
  }
  return totals
}

function firstActive<T extends { status: string | null }>(rows: T[]) {
  return rows.find((row) => row.status === 'active') ?? rows[0] ?? null
}

export async function salesBillLineFactsForBills(
  billIds: bigint[],
  options: SalesBillLineFactOptions = {},
): Promise<SalesBillLineFactRow[]> {
  if (!billIds.length) return []
  const lineStatuses = options.lineStatuses ?? ['active']
  const tradingStatuses = options.tradingStatuses ?? ['active']
  const [lines, tradingFacts] = await Promise.all([
    prisma.sales_bill_lines.findMany({
      include: {
        products: true,
        sales_bill_po_sell_allocations: { orderBy: { id: 'asc' } },
        sales_bill_source_allocations: { orderBy: { id: 'asc' } },
        sales_bills: {
          include: {
            branches: true,
            customers: true,
            sales_channels: true,
            warehouses: true,
          },
        },
      },
      orderBy: [{ sales_bill_id: 'asc' }, { line_no: 'asc' }],
      where: {
        sales_bill_id: { in: billIds },
        status: { in: lineStatuses },
      },
    }),
    prisma.trading_allocation_facts.findMany({
      where: {
        sales_bill_id: { in: billIds },
        status: { in: tradingStatuses },
      },
    }),
  ])
  const matchedCogsByLine = sumTradingFactsByLine(tradingFacts)
  return lines.map((line) => salesBillLineFactRow(line, matchedCogsByLine.get(lineKey(line.sales_bill_id, line.line_no)) ?? 0))
}

export async function salesBillLineFactsByBillId(
  billIds: bigint[],
  options: SalesBillLineFactOptions = {},
) {
  const rows = await salesBillLineFactsForBills(billIds, options)
  const byBillId = new Map<bigint, SalesBillLineFactRow[]>()
  for (const row of rows) {
    const current = byBillId.get(row.billId) ?? []
    current.push(row)
    byBillId.set(row.billId, current)
  }
  return byBillId
}

export function salesBillLineFactTotals(rows: SalesBillLineFactRow[] | undefined) {
  return (rows ?? []).reduce((sum, row) => ({
    amount: sum.amount + row.lineAmount,
    cogs: sum.cogs + row.cogs,
    gp: sum.gp + row.gp,
    qty: sum.qty + row.qty,
  }), { amount: 0, cogs: 0, gp: 0, qty: 0 })
}

function salesBillLineFactRow(line: SalesBillLineWithFacts, matchedCogs: number): SalesBillLineFactRow {
  const source = firstActive(line.sales_bill_source_allocations)
  const poSell = firstActive(line.sales_bill_po_sell_allocations)
  const amount = toNumber(line.line_amount)
  const cogs = matchedCogs
  return {
    allocationType: poSell?.allocation_type ?? '',
    billId: line.sales_bill_id,
    branchId: line.sales_bills.branch_id ?? null,
    branchName: line.sales_bills.branches?.name ?? '-',
    channelName: line.sales_bills.sales_channels?.name ?? '-',
    cogs,
    customerId: line.sales_bills.customer_id ?? null,
    customerName: line.sales_bills.customers?.name ?? '-',
    date: line.sales_bills.date,
    dateText: toDateOnly(line.sales_bills.date),
    discountAmount: toNumber(line.discount_amount),
    docNo: line.sales_bills.doc_no,
    gp: amount - cogs,
    grossWeight: toNumber(line.gross_weight),
    lineAmount: amount,
    lineNo: line.line_no,
    lineStatus: line.status,
    matchedCogs,
    netWeight: toNumber(line.net_weight),
    poSellDocNo: poSell?.po_sell_doc_no ?? '',
    productCode: line.product_code_snapshot || line.products?.code || '',
    productId: line.product_id ?? null,
    productName: line.product_name_snapshot || line.products?.name || 'ไม่ระบุสินค้า',
    qty: toNumber(line.qty || line.net_weight),
    sourceDocNo: source?.source_doc_no ?? '',
    sourceType: source?.source_type ?? '',
    status: line.sales_bills.status ?? '',
    transactionMode: line.sales_bills.transaction_mode ?? 'STOCK',
    unit: line.unit_snapshot ?? line.products?.unit ?? 'kg',
    unitPrice: toNumber(line.unit_price),
    vatAmount: toNumber(line.vat_amount),
    warehouseName: line.sales_bills.warehouses?.name ?? '-',
  }
}
