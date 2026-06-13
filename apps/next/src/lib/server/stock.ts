import type { Prisma } from '../../../generated/prisma/client'
import { parseInternalBigIntId, requireBusinessCode } from '@/lib/business-code'
import { findActiveBranchReferenceByCodeOrId } from '@/lib/server/branch-reference'
import { normalizeDate, toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'
import { findActiveWarehouseReferenceByCodeOrId } from '@/lib/server/warehouse-reference'
import { applyWorksheetTableLayout } from '@/lib/server/xlsx'
import * as XLSX from 'xlsx'

export type StockBalanceKey = {
  branchId: string | bigint | null
  lotNo: string | null
  notAvailable: boolean
  productId: string | null
  status: string | null
  warehouseId: string | bigint | null
}

const stockLedgerInclude = {
  branches: true,
  products: { select: { code: true, metal_group: true, name: true } },
  warehouses: true,
} as const

export function stockKey(input: StockBalanceKey) {
  return [
    input.productId ?? '-',
    input.branchId ?? '-',
    input.warehouseId ?? '-',
    input.lotNo ?? '-',
    input.status ?? '-',
    input.notAvailable ? 'NA' : 'A',
  ].join('|')
}

function stockBucketInternalKey(input: {
  branchId: bigint | null
  lotNo: string | null
  notAvailable: boolean
  productId: bigint | null
  status: string | null
  warehouseId: bigint | null
}) {
  return [
    input.productId?.toString() ?? '-',
    input.branchId?.toString() ?? '-',
    input.warehouseId?.toString() ?? '-',
    input.lotNo ?? '-',
    input.status ?? '-',
    input.notAvailable ? 'NA' : 'A',
  ].join('|')
}

export function stockWhere(input: {
  asOf?: string | null
  branchId?: bigint | null
  from?: string | null
  lotNo?: string | null
  movementType?: string | null
  productId?: bigint | null
  refType?: string | null
  status?: string | null
  to?: string | null
  warehouseId?: bigint | null
}): Prisma.stock_ledgerWhereInput {
  return {
    ...(input.productId ? { product_id: input.productId } : {}),
    ...(input.branchId ? { branch_id: input.branchId } : {}),
    ...(input.warehouseId ? { warehouse_id: input.warehouseId } : {}),
    ...(input.movementType ? { movement_type: input.movementType } : {}),
    ...(input.refType ? { ref_type: input.refType } : {}),
    ...(input.lotNo ? { lot_no: { contains: input.lotNo, mode: 'insensitive' } } : {}),
    ...(input.status ? { output_category: input.status } : {}),
    ...dateWhere(input),
  }
}

export async function normalizeStockReferenceInput(input: {
  branchId?: string | bigint | null
  productId?: string | bigint | null
  warehouseId?: string | bigint | null
}): Promise<{ branchId: bigint | null; productId: bigint | null; warehouseId: bigint | null }> {
  const [branch, warehouse, product] = await Promise.all([
    input.branchId ? findActiveBranchReferenceByCodeOrId(input.branchId) : Promise.resolve(null),
    input.warehouseId ? findActiveWarehouseReferenceByCodeOrId(input.warehouseId) : Promise.resolve(null),
    input.productId
      ? prisma.products.findFirst({
        select: { id: true },
        where: {
          OR: [
            { code: String(input.productId).trim().toUpperCase() },
            ...(parseInternalBigIntId(input.productId) != null ? [{ id: parseInternalBigIntId(input.productId) as bigint }] : []),
          ],
        },
      })
      : Promise.resolve(null),
  ])

  return {
    branchId: branch?.id ?? null,
    productId: product?.id ?? null,
    warehouseId: warehouse?.id ?? null,
  }
}

function dateWhere(input: { asOf?: string | null; from?: string | null; to?: string | null }): Prisma.stock_ledgerWhereInput {
  if (input.asOf) return { date: { lte: normalizeDate(input.asOf) } }
  if (input.from || input.to) {
    return {
      date: {
        ...(input.from ? { gte: normalizeDate(input.from) } : {}),
        ...(input.to ? { lte: normalizeDate(input.to) } : {}),
      },
    }
  }
  return {}
}

export async function stockReferenceData(input?: { includeCustomers?: boolean }) {
  const [branches, warehouses, products, customers] = await Promise.all([
    prisma.branches.findMany({ orderBy: [{ name: 'asc' }], select: { active: true, code: true, id: true, name: true } }),
    prisma.warehouses.findMany({
      orderBy: [{ name: 'asc' }],
      select: { active: true, branches: { select: { code: true } }, branch_id: true, code: true, id: true, name: true },
    }),
    prisma.products.findMany({ orderBy: [{ code: 'asc' }, { name: 'asc' }], select: { active: true, code: true, id: true, metal_group: true, name: true } }),
    input?.includeCustomers === false
      ? Promise.resolve([])
      : prisma.customers.findMany({ orderBy: [{ code: 'asc' }, { name: 'asc' }], select: { active: true, code: true, id: true, name: true } }),
  ])

  return {
    branches: branches.map((row) => {
      const code = requireBusinessCode(row.code, `สาขา ${row.id}`)
      return { active: row.active, code, id: code, name: row.name }
    }),
    customers: customers.map((row) => {
      const code = requireBusinessCode(row.code, `ลูกค้า ${row.id}`)
      return { active: row.active, code, id: code, name: row.name }
    }),
    products: products.map((row) => ({ active: row.active, code: row.code, id: row.code, metalGroup: row.metal_group, name: row.name, status: null })),
    warehouses: warehouses.map((row) => ({
      active: row.active,
      branchId: row.branches ? requireBusinessCode(row.branches.code, `สาขาคลัง ${row.branch_id ?? row.id}`) : null,
      code: row.code,
      id: row.code,
      name: row.name,
    })),
  }
}

export async function stockBalanceSnapshot(input: {
  asOf?: string | null
  branchId?: string | bigint | null
  lotNo?: string | null
  onHold?: boolean | null
  productId?: string | bigint | null
  q?: string | null
  status?: string | null
  warehouseId?: string | bigint | null
}) {
  const normalizedInput = await normalizeStockReferenceInput(input)
  const where = stockWhere({
    asOf: input.asOf,
    branchId: normalizedInput.branchId,
    lotNo: input.lotNo,
    productId: normalizedInput.productId,
    status: input.status,
    warehouseId: normalizedInput.warehouseId,
  })
  const ledgerRows = await prisma.stock_ledger.findMany({
    include: stockLedgerInclude,
    orderBy: [{ date: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
    where,
  })
  const holdSums = await prisma.stock_holds.groupBy({
    _sum: { qty: true },
    by: ['branch_id', 'product_id', 'warehouse_id', 'output_category', 'lot_no', 'not_available_for_sale'],
    where: {
      status: 'active',
      ...(normalizedInput.branchId ? { branch_id: normalizedInput.branchId } : {}),
      ...(normalizedInput.productId ? { product_id: normalizedInput.productId } : {}),
      ...(normalizedInput.warehouseId ? { warehouse_id: normalizedInput.warehouseId } : {}),
    },
  })
  const holdQtyByStockKey = new Map(
    holdSums.map((row) => [
      stockBucketInternalKey({
        branchId: row.branch_id,
        lotNo: row.lot_no,
        notAvailable: row.not_available_for_sale === true,
        productId: row.product_id,
        status: row.output_category,
        warehouseId: row.warehouse_id,
      }),
      toNumber(row._sum.qty),
    ]),
  )

  const grouped = new Map<string, {
    avgCost: number
    branchInternalId: bigint | null
    branchId: string
    branchName: string
    key: string
    lastDate: string
    lotNo: string
    notAvailable: boolean
    onHoldQty: number
    productInternalId: bigint | null
    productCode: string
    productId: string
    productMetalGroup: string
    productName: string
    qty: number
    readyQty: number
    status: string
    value: number
    warehouseInternalId: bigint | null
    warehouseId: string
    warehouseName: string
  }>()

  for (const row of ledgerRows) {
    const productStatus = row.output_category ?? '-'
    const key = stockKey({
      branchId: row.branches?.code ?? null,
      lotNo: row.lot_no ?? null,
      notAvailable: row.not_available_for_sale === true,
      productId: row.products?.code ?? null,
      status: productStatus,
      warehouseId: row.warehouses?.code ?? null,
    })
    const current = grouped.get(key) ?? {
      avgCost: 0,
      branchInternalId: row.branch_id ?? null,
      branchId: row.branches?.code ?? '',
      branchName: row.branches?.name ?? '-',
      key,
      lastDate: toDateOnly(row.date),
      lotNo: row.lot_no ?? '',
      notAvailable: row.not_available_for_sale === true,
      onHoldQty: 0,
      productInternalId: row.product_id ?? null,
      productCode: row.products?.code ?? '',
      productId: row.products?.code ?? '',
      productMetalGroup: row.products?.metal_group ?? 'อื่นๆ',
      productName: row.products?.name ?? '-',
      qty: 0,
      readyQty: 0,
      status: productStatus,
      value: 0,
      warehouseInternalId: row.warehouse_id ?? null,
      warehouseId: row.warehouses?.code ?? '',
      warehouseName: row.warehouses?.name ?? '-',
    }
    current.qty += toNumber(row.qty_in) - toNumber(row.qty_out)
    current.value += toNumber(row.value_in) - toNumber(row.value_out)
    current.avgCost = current.qty > 0 ? current.value / current.qty : 0
    current.lastDate = toDateOnly(row.date)
    grouped.set(key, current)
  }

  const query = input.q?.trim().toLowerCase()
  const rows = Array.from(grouped.values())
    .filter((row) => Math.abs(row.qty) > 0.000001 || Math.abs(row.value) > 0.000001)
    .filter((row) => !query || `${row.productCode} ${row.productName} ${row.productMetalGroup} ${row.branchName} ${row.warehouseName} ${row.lotNo} ${row.status}`.toLowerCase().includes(query))
    .sort((left, right) => left.productMetalGroup.localeCompare(right.productMetalGroup) || left.productCode.localeCompare(right.productCode) || left.branchName.localeCompare(right.branchName) || left.warehouseName.localeCompare(right.warehouseName))

  for (const row of rows) {
    if (row.notAvailable || row.qty <= 0) {
      row.readyQty = 0
      continue
    }
    const holdKey = stockBucketInternalKey({
      branchId: row.branchInternalId,
      lotNo: row.lotNo || null,
      notAvailable: row.notAvailable,
      productId: row.productInternalId,
      status: row.status || null,
      warehouseId: row.warehouseInternalId,
    })
    const remainingHold = holdQtyByStockKey.get(holdKey) ?? 0
    row.onHoldQty = Math.min(row.qty, Math.max(0, remainingHold))
    row.readyQty = Math.max(0, row.qty - row.onHoldQty)
    holdQtyByStockKey.set(holdKey, Math.max(0, remainingHold - row.onHoldQty))
  }

  const filteredRows = input.onHold ? rows.filter((row) => row.onHoldQty > 0) : rows

  const summary = filteredRows.reduce((acc, row) => {
    acc.onHoldQty += row.onHoldQty
    acc.qty += row.qty
    acc.readyQty += row.readyQty
    acc.value += row.value
    if (row.notAvailable) {
      acc.notAvailableQty += row.qty
      acc.notAvailableValue += row.value
    } else {
      acc.availableQty += row.qty
      acc.availableValue += row.value
    }
    if (row.qty < 0) acc.negativeRows += 1
    return acc
  }, { availableQty: 0, availableValue: 0, count: filteredRows.length, negativeRows: 0, notAvailableQty: 0, notAvailableValue: 0, onHoldQty: 0, qty: 0, readyQty: 0, value: 0 })

  const byStatus = ['RM', 'WIP', 'FG'].map((status) => {
    const statusRows = filteredRows.filter((row) => row.status === status)
    return {
      count: statusRows.length,
      qty: statusRows.reduce((sum, row) => sum + row.qty, 0),
      status,
      value: statusRows.reduce((sum, row) => sum + row.value, 0),
    }
  })

  const publicRows = filteredRows.map(({ branchInternalId: _branchInternalId, productInternalId: _productInternalId, warehouseInternalId: _warehouseInternalId, ...row }) => row)

  return { byStatus, rows: publicRows, summary }
}

export async function stockBalanceDetail(input: {
  branchId: string | bigint
  lotNo?: string | null
  notAvailable?: boolean
  productId: string | bigint
  status?: string | null
  warehouseId: string | bigint
}) {
  const normalizedInput = await normalizeStockReferenceInput(input)
  if (!normalizedInput.branchId || !normalizedInput.productId || !normalizedInput.warehouseId) {
    throw new Error('ระบุสินค้า สาขา และคลังให้ครบก่อนดูรายละเอียด')
  }
  const lotNo = input.lotNo?.trim() || null
  const status = input.status?.trim() || null
  const notAvailable = input.notAvailable === true

  const [ledgerRows, holdRows] = await Promise.all([
    prisma.stock_ledger.findMany({
      include: stockLedgerInclude,
      orderBy: [{ date: 'desc' }, { created_at: 'desc' }, { id: 'desc' }],
      take: 80,
      where: {
        branch_id: normalizedInput.branchId,
        lot_no: lotNo,
        ...(notAvailable ? { not_available_for_sale: true } : { OR: [{ not_available_for_sale: false }, { not_available_for_sale: null }] }),
        output_category: status,
        product_id: normalizedInput.productId,
        warehouse_id: normalizedInput.warehouseId,
      },
    }),
    prisma.stock_holds.findMany({
      include: {
        weight_ticket_lines: { select: { line_no: true, net_weight: true, product_name: true } },
        weight_tickets: { include: { customers: { select: { code: true, name: true } } } },
      },
      orderBy: [{ held_at: 'desc' }, { id: 'desc' }],
      take: 80,
      where: {
        branch_id: normalizedInput.branchId,
        lot_no: lotNo,
        not_available_for_sale: notAvailable,
        output_category: status,
        product_id: normalizedInput.productId,
        status: 'active',
        warehouse_id: normalizedInput.warehouseId,
      },
    }),
  ])

  return {
    holds: holdRows.map((row) => ({
      customerCode: row.weight_tickets.customers?.code ?? '',
      customerName: row.weight_tickets.customers?.name ?? '-',
      heldAt: row.held_at.toISOString(),
      holdKey: row.hold_key,
      lotNo: row.lot_no ?? '',
      qty: toNumber(row.qty),
      sourceDocNo: row.source_doc_no,
      sourceLineNo: row.source_line_no ?? row.weight_ticket_lines?.line_no ?? null,
      status: row.status,
      weightTicketDate: toDateOnly(row.weight_tickets.document_date),
    })),
    ledgerRows: ledgerRows.map((row) => ({
      createdAt: row.created_at ? row.created_at.toISOString() : '',
      date: toDateOnly(row.date),
      id: row.ledger_key,
      movementType: row.movement_type,
      note: row.note ?? row.notes ?? '',
      qtyIn: toNumber(row.qty_in),
      qtyOut: toNumber(row.qty_out),
      refNo: row.ref_no ?? row.ref_id ?? '',
      refType: row.ref_type ?? '',
      unitCost: toNumber(row.unit_cost),
      valueIn: toNumber(row.value_in),
      valueOut: toNumber(row.value_out),
    })),
  }
}

export async function averageCostForStock(input: { branchId?: bigint | null; lotNo?: string | null; productId: string | bigint; status?: string | null; warehouseId?: bigint | null }) {
  const snapshot = await stockBalanceSnapshot(input)
  const totalQty = snapshot.rows.reduce((sum, row) => sum + row.qty, 0)
  const totalValue = snapshot.rows.reduce((sum, row) => sum + row.value, 0)
  return totalQty > 0 ? totalValue / totalQty : 0
}

export async function quantityForStock(input: { branchId?: bigint | null; lotNo?: string | null; productId: string | bigint; quantityType?: 'onHand' | 'ready'; status?: string | null; warehouseId?: bigint | null }) {
  const snapshot = await stockBalanceSnapshot(input)
  const field = input.quantityType === 'ready' ? 'readyQty' : 'qty'
  return snapshot.rows.reduce((sum, row) => sum + row[field], 0)
}

export function buildStockWorkbook(sheetName: string, rows: Array<Record<string, string | number | boolean | null>>) {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows)
  const headers = rows[0] ? Object.keys(rows[0]) : []
  sheet['!cols'] = headers.map((header) => ({ wch: Math.max(12, header.length + 4) }))
  applyWorksheetTableLayout(sheet, headers.length, rows.length + 1)
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer
}

export function xlsxResponse(body: Buffer, filename: string) {
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  })
}
