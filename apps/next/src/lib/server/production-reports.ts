import type { Prisma } from '../../../generated/prisma/client'
import { parseInternalBigIntId } from '@/lib/business-code'
import { findActiveBranchReferenceByCodeOrId } from '@/lib/server/branch-reference'
import { prisma } from '@/lib/server/prisma'
import { toDateOnly, toNumber } from '@/lib/server/daily'

export type ProductionReportFilters = {
  branchId?: string
  dateFrom?: string
  dateTo?: string
  machineId?: string
  status?: string
}

export type ProductionOrderMetric = {
  branchName: string
  costPerKg: number
  costBreakdown: Record<string, number>
  costAllocationMethod: string
  date: string
  docNo: string
  id: string
  inputCost: number
  inputQty: number
  ledgerBalanced: boolean
  ledgerMismatchQty: number
  lossPct: number
  lossQty: number
  machineName: string
  normalLossPercent: number
  outputQty: number
  outputValue: number
  processCost: number
  productCode: string
  productName: string
  productionLineName: string
  productionType: string
  status: string
  totalCost: number
  variance: number
  warehouseName: string
  wipQty: number
  wipValue: number
  yieldPct: number
}

type ProductionLedgerMetric = {
  inputQty: number
  inputValue: number
  lossQty: number
  outputQty: number
  outputValue: number
  wipConsumedQty: number
  wipConsumedValue: number
}

const emptyLedgerMetric = (): ProductionLedgerMetric => ({
  inputQty: 0,
  inputValue: 0,
  lossQty: 0,
  outputQty: 0,
  outputValue: 0,
  wipConsumedQty: 0,
  wipConsumedValue: 0,
})

export function productionWhere(filters: ProductionReportFilters, branchId?: bigint | null): Prisma.production_ordersWhereInput {
  const machineId = parseInternalBigIntId(filters.machineId)
  return {
    ...(branchId != null ? { branch_id: branchId } : {}),
    ...(machineId != null ? { machine_id: machineId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.dateFrom || filters.dateTo ? {
      date: {
        ...(filters.dateFrom ? { gte: new Date(`${filters.dateFrom}T00:00:00.000Z`) } : {}),
        ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T00:00:00.000Z`) } : {}),
      },
    } : {}),
    NOT: { status: 'Cancelled' },
  }
}

export async function loadProductionMetrics(filters: ProductionReportFilters = {}) {
  const branch = filters.branchId ? await findActiveBranchReferenceByCodeOrId(filters.branchId) : null
  const [orders, categories] = await Promise.all([
    prisma.production_orders.findMany({
      include: {
        branches: true,
        process_costs: true,
        production_inputs: { where: { status: 'active' } },
        production_lines: true,
        production_machines: true,
        production_outputs: { include: { products: true }, where: { status: 'active' } },
        products: true,
        warehouses: true,
      },
      orderBy: [{ date: 'desc' }, { doc_no: 'desc' }],
      where: productionWhere(filters, branch?.id ?? null),
    }),
    prisma.production_output_categories.findMany(),
  ])
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const inputOwnerById = new Map<string, string>()
  const outputOwnerById = new Map<string, string>()
  const factMetricByOrder = new Map<string, ProductionLedgerMetric>()
  orders.forEach((order) => {
    const orderKey = order.id.toString()
    const factMetric = emptyLedgerMetric()
    order.production_inputs.forEach((input) => {
      inputOwnerById.set(input.id.toString(), orderKey)
      factMetric.inputQty += toNumber(input.qty)
      factMetric.inputValue += toNumber(input.total_cost)
    })
    order.production_outputs.forEach((output) => {
      outputOwnerById.set(output.id.toString(), orderKey)
      const sourceWipQty = toNumber(output.source_wip_qty) || toNumber(output.qty)
      const totalCost = toNumber(output.total_cost)
      factMetric.wipConsumedQty += sourceWipQty
      factMetric.wipConsumedValue += totalCost
      if (output.category_code === 'LOSS' || output.output_status === 'LOSS' || output.output_type === 'Loss') {
        factMetric.lossQty += sourceWipQty
      } else {
        factMetric.outputQty += toNumber(output.qty)
        factMetric.outputValue += totalCost
      }
    })
    factMetricByOrder.set(orderKey, factMetric)
  })
  const ledgerMetricByOrder = new Map<string, ProductionLedgerMetric>()
  const ledgerRows = inputOwnerById.size || outputOwnerById.size
    ? await prisma.stock_ledger.findMany({
        select: { movement_type: true, qty_in: true, qty_out: true, ref_id: true, ref_type: true, value_in: true, value_out: true },
        where: {
          OR: [
            ...(inputOwnerById.size ? [{ ref_id: { in: [...inputOwnerById.keys()] }, ref_type: 'PI' }] : []),
            ...(outputOwnerById.size ? [{ ref_id: { in: [...outputOwnerById.keys()] }, ref_type: 'PO2' }] : []),
          ],
        },
      })
    : []
  ledgerRows.forEach((row) => {
    const refId = String(row.ref_id ?? '')
    const orderKey = row.ref_type === 'PI' ? inputOwnerById.get(refId) : outputOwnerById.get(refId)
    if (!orderKey) return
    const metric = ledgerMetricByOrder.get(orderKey) ?? emptyLedgerMetric()
    if (row.ref_type === 'PI' && row.movement_type === 'WIP_IN') {
      metric.inputQty += toNumber(row.qty_in)
      metric.inputValue += toNumber(row.value_in)
    } else if (row.ref_type === 'PO2' && row.movement_type === 'PRODUCTION_OUTPUT_WIP_OUT') {
      metric.wipConsumedQty += toNumber(row.qty_out)
      metric.wipConsumedValue += toNumber(row.value_out)
    } else if (row.ref_type === 'PO2' && row.movement_type === 'PRODUCTION_LOSS') {
      metric.lossQty += toNumber(row.qty_out)
      metric.wipConsumedQty += toNumber(row.qty_out)
      metric.wipConsumedValue += toNumber(row.value_out)
    } else if (row.ref_type === 'PO2' && ['PRODUCTION_OUTPUT_IN', 'PRODUCTION_OUTPUT_RM_IN'].includes(row.movement_type ?? '')) {
      metric.outputQty += toNumber(row.qty_in)
      metric.outputValue += toNumber(row.value_in)
    }
    ledgerMetricByOrder.set(orderKey, metric)
  })

  return orders.map((order): ProductionOrderMetric => {
    const orderKey = order.id.toString()
    const facts = factMetricByOrder.get(orderKey) ?? emptyLedgerMetric()
    const ledgers = ledgerMetricByOrder.get(orderKey) ?? emptyLedgerMetric()
    const inputQty = ledgers.inputQty
    const inputCost = ledgers.inputValue
    const outputs = order.production_outputs.filter((output) => {
      const category = output.output_category != null ? categoryById.get(output.output_category) : null
      return output.output_status !== 'LOSS' && output.output_type !== 'Loss' && category?.stock_effect !== 'loss'
    })
    const outputQty = ledgers.outputQty
    const lossQty = ledgers.lossQty
    const outputValue = ledgers.outputValue
    const processCost = order.process_costs
      .filter((cost) => cost.status !== 'reversed' && cost.include_in_production)
      .reduce((sum, cost) => sum + toNumber(cost.amount), 0)
    const totalCost = inputCost + processCost
    const rawWipQty = inputQty - ledgers.wipConsumedQty
    const rawWipValue = inputCost - ledgers.wipConsumedValue
    const wipQty = Math.max(0, rawWipQty)
    const ledgerMismatchQty = Math.abs((facts.inputQty - facts.wipConsumedQty) - rawWipQty)
    const ledgerBalanced = ledgerMismatchQty <= 0.000001
    const wipValue = Math.max(0, rawWipValue)

    return {
      branchName: order.branches?.name ?? '-',
      costAllocationMethod: order.cost_allocation_method ?? order.production_type ?? '-',
      costPerKg: outputQty > 0 ? totalCost / outputQty : 0,
      costBreakdown: Object.fromEntries(order.process_costs
        .filter((cost) => cost.status !== 'reversed' && cost.include_in_production)
        .reduce((map, cost) => map.set(cost.cost_type, (map.get(cost.cost_type) ?? 0) + toNumber(cost.amount)), new Map<string, number>())),
      date: toDateOnly(order.date),
      docNo: order.doc_no,
      id: order.doc_no,
      inputCost,
      inputQty,
      ledgerBalanced,
      ledgerMismatchQty,
      lossPct: inputQty > 0 ? lossQty / inputQty * 100 : 0,
      lossQty,
      machineName: order.production_machines?.name ?? '-',
      normalLossPercent: toNumber(order.normal_loss_percent),
      outputQty,
      outputValue,
      processCost,
      productCode: order.products?.code ?? '',
      productName: order.products?.name ?? '-',
      productionLineName: order.production_lines?.name ?? '-',
      productionType: order.production_type ?? '-',
      status: order.status ?? 'Open',
      totalCost,
      variance: outputValue - totalCost || toNumber(order.variance),
      warehouseName: order.warehouses?.name ?? '-',
      wipQty,
      wipValue,
      yieldPct: inputQty > 0 ? outputQty / inputQty * 100 : 0,
    }
  })
}

export function summarizeProductionMetrics(rows: ProductionOrderMetric[]) {
  const inputQty = rows.reduce((sum, row) => sum + row.inputQty, 0)
  const outputQty = rows.reduce((sum, row) => sum + row.outputQty, 0)
  const lossQty = rows.reduce((sum, row) => sum + row.lossQty, 0)
  const inputCost = rows.reduce((sum, row) => sum + row.inputCost, 0)
  const processCost = rows.reduce((sum, row) => sum + row.processCost, 0)
  const totalCost = inputCost + processCost

  return {
    costPerKg: outputQty > 0 ? totalCost / outputQty : 0,
    count: rows.length,
    inputCost,
    inputQty,
    lossPct: inputQty > 0 ? lossQty / inputQty * 100 : 0,
    lossQty,
    outputQty,
    processCost,
    totalCost,
    wipQty: rows.reduce((sum, row) => sum + row.wipQty, 0),
    wipValue: rows.reduce((sum, row) => sum + row.wipValue, 0),
    yieldPct: inputQty > 0 ? outputQty / inputQty * 100 : 0,
  }
}
