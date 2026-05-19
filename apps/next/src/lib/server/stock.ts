import type { Prisma } from '../../../generated/prisma/client'
import { normalizeDate, toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'
import { applyWorksheetTableLayout } from '@/lib/server/xlsx'
import * as XLSX from 'xlsx'

export type StockBalanceKey = {
  branchId: string | null
  lotNo: string | null
  notAvailable: boolean
  productId: string | null
  status: string | null
  warehouseId: string | null
}

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

export function stockWhere(input: {
  asOf?: string | null
  branchId?: string | null
  from?: string | null
  lotNo?: string | null
  productId?: string | null
  refType?: string | null
  status?: string | null
  to?: string | null
  warehouseId?: string | null
}): Prisma.stock_ledgerWhereInput {
  return {
    ...(input.productId ? { product_id: input.productId } : {}),
    ...(input.branchId ? { branch_id: input.branchId } : {}),
    ...(input.warehouseId ? { warehouse_id: input.warehouseId } : {}),
    ...(input.refType ? { ref_type: input.refType } : {}),
    ...(input.lotNo ? { lot_no: { contains: input.lotNo, mode: 'insensitive' } } : {}),
    ...(input.status ? { output_category: input.status } : {}),
    ...dateWhere(input),
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

export async function stockReferenceData() {
  const [branches, warehouses, products, customers] = await Promise.all([
    prisma.branches.findMany({ orderBy: [{ name: 'asc' }], select: { active: true, code: true, id: true, name: true } }),
    prisma.warehouses.findMany({ orderBy: [{ name: 'asc' }], select: { active: true, branch_id: true, code: true, id: true, name: true } }),
    prisma.products.findMany({ orderBy: [{ code: 'asc' }, { name: 'asc' }], select: { active: true, code: true, id: true, item_status: true, metal_group: true, name: true } }),
    prisma.customers.findMany({ orderBy: [{ code: 'asc' }, { name: 'asc' }], select: { active: true, code: true, id: true, name: true } }),
  ])

  return {
    branches: branches.map((row) => ({ active: row.active, code: row.code, id: row.id, name: row.name })),
    customers: customers.map((row) => ({ active: row.active, code: row.code, id: row.id, name: row.name })),
    products: products.map((row) => ({ active: row.active, code: row.code, id: row.id, metalGroup: row.metal_group, name: row.name, status: row.item_status })),
    warehouses: warehouses.map((row) => ({ active: row.active, branchId: row.branch_id, code: row.code, id: row.id, name: row.name })),
  }
}

export async function stockBalanceSnapshot(input: {
  asOf?: string | null
  branchId?: string | null
  lotNo?: string | null
  productId?: string | null
  q?: string | null
  status?: string | null
  warehouseId?: string | null
}) {
  const where = stockWhere(input)
  const ledgerRows = await prisma.stock_ledger.findMany({
    include: { branches: true, products: true, warehouses: true },
    orderBy: [{ date: 'asc' }, { created_at: 'asc' }, { id: 'asc' }],
    where,
  })

  const grouped = new Map<string, {
    avgCost: number
    branchId: string
    branchName: string
    key: string
    lastDate: string
    lotNo: string
    notAvailable: boolean
    productCode: string
    productId: string
    productMetalGroup: string
    productName: string
    qty: number
    status: string
    value: number
    warehouseId: string
    warehouseName: string
  }>()

  for (const row of ledgerRows) {
    const productStatus = row.output_category ?? row.products?.item_status ?? '-'
    const key = stockKey({
      branchId: row.branch_id ?? null,
      lotNo: row.lot_no ?? null,
      notAvailable: row.not_available_for_sale === true,
      productId: row.product_id ?? null,
      status: productStatus,
      warehouseId: row.warehouse_id ?? null,
    })
    const current = grouped.get(key) ?? {
      avgCost: 0,
      branchId: row.branch_id ?? '',
      branchName: row.branches?.name ?? '-',
      key,
      lastDate: toDateOnly(row.date),
      lotNo: row.lot_no ?? '',
      notAvailable: row.not_available_for_sale === true,
      productCode: row.products?.code ?? '',
      productId: row.product_id ?? '',
      productMetalGroup: row.products?.metal_group ?? 'อื่นๆ',
      productName: row.products?.name ?? row.product_id ?? '-',
      qty: 0,
      status: productStatus,
      value: 0,
      warehouseId: row.warehouse_id ?? '',
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

  const summary = rows.reduce((acc, row) => {
    acc.qty += row.qty
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
  }, { availableQty: 0, availableValue: 0, count: rows.length, negativeRows: 0, notAvailableQty: 0, notAvailableValue: 0, qty: 0, value: 0 })

  const byStatus = ['RM', 'WIP', 'FG'].map((status) => {
    const statusRows = rows.filter((row) => row.status === status)
    return {
      count: statusRows.length,
      qty: statusRows.reduce((sum, row) => sum + row.qty, 0),
      status,
      value: statusRows.reduce((sum, row) => sum + row.value, 0),
    }
  })

  return { byStatus, rows, summary }
}

export async function averageCostForStock(input: { branchId?: string | null; lotNo?: string | null; productId: string; warehouseId?: string | null }) {
  const snapshot = await stockBalanceSnapshot(input)
  const totalQty = snapshot.rows.reduce((sum, row) => sum + row.qty, 0)
  const totalValue = snapshot.rows.reduce((sum, row) => sum + row.value, 0)
  return totalQty > 0 ? totalValue / totalQty : 0
}

export async function quantityForStock(input: { branchId?: string | null; lotNo?: string | null; productId: string; status?: string | null; warehouseId?: string | null }) {
  const snapshot = await stockBalanceSnapshot(input)
  return snapshot.rows.reduce((sum, row) => sum + row.qty, 0)
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
