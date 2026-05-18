import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'stock.ledger.view')

    const url = new URL(request.url)
    const refType = url.searchParams.get('refType') || undefined
    const productId = url.searchParams.get('productId') || undefined
    const limit = Math.min(5000, Math.max(100, Number(url.searchParams.get('limit') ?? 1000) || 1000))

    const rows = await prisma.stock_ledger.findMany({
      include: {
        branches: true,
        products: true,
        warehouses: true,
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: limit,
      where: {
        ...(productId ? { product_id: productId } : {}),
        ...(refType ? { ref_type: refType } : {}),
      },
    })

    const purchaseBillIds = [...new Set(rows.filter((row) => row.ref_type === 'PB' && row.ref_id).map((row) => row.ref_id as string))]
    const salesBillIds = [...new Set(rows.filter((row) => row.ref_type === 'SB' && row.ref_id).map((row) => row.ref_id as string))]
    const [purchaseBills, salesBills] = await Promise.all([
      purchaseBillIds.length
        ? prisma.purchase_bills.findMany({ include: { suppliers: true }, where: { id: { in: purchaseBillIds } } })
        : Promise.resolve([]),
      salesBillIds.length
        ? prisma.sales_bills.findMany({ include: { customers: true }, where: { id: { in: salesBillIds } } })
        : Promise.resolve([]),
    ])
    const purchaseById = new Map(purchaseBills.map((bill) => [bill.id, bill]))
    const salesById = new Map(salesBills.map((bill) => [bill.id, bill]))

    const balanceByProduct = new Map<string, number>()
    const chronological = [...rows].sort((left, right) => toDateOnly(left.date).localeCompare(toDateOnly(right.date)) || left.id.localeCompare(right.id))
    chronological.forEach((row) => {
      const productKey = row.product_id ?? ''
      if (!productKey) return
      balanceByProduct.set(productKey, (balanceByProduct.get(productKey) ?? 0) + toNumber(row.qty_in) - toNumber(row.qty_out))
    })

    const payloadRows = rows.map((row) => {
      const purchaseBill = row.ref_type === 'PB' && row.ref_id ? purchaseById.get(row.ref_id) : null
      const salesBill = row.ref_type === 'SB' && row.ref_id ? salesById.get(row.ref_id) : null
      return {
        branchName: row.branches?.name ?? '-',
        counterpartyName: purchaseBill?.suppliers?.name ?? salesBill?.customers?.name ?? '-',
        date: toDateOnly(row.date),
        id: row.id,
        movementType: row.movement_type,
        productCode: row.products?.code ?? '',
        productId: row.product_id ?? '',
        productName: row.products?.name ?? row.product_id ?? '-',
        qtyIn: toNumber(row.qty_in),
        qtyOut: toNumber(row.qty_out),
        refId: row.ref_id ?? '',
        refNo: row.ref_no ?? '',
        refType: row.ref_type ?? '',
        runningBalanceByProduct: row.product_id ? balanceByProduct.get(row.product_id) ?? 0 : 0,
        unitCost: toNumber(row.unit_cost),
        valueIn: toNumber(row.value_in),
        valueOut: toNumber(row.value_out),
        warehouseName: row.warehouses?.name ?? '-',
      }
    })

    return NextResponse.json({
      rows: payloadRows,
      summary: {
        count: payloadRows.length,
        qtyIn: payloadRows.reduce((sum, row) => sum + row.qtyIn, 0),
        qtyOut: payloadRows.reduce((sum, row) => sum + row.qtyOut, 0),
        valueIn: payloadRows.reduce((sum, row) => sum + row.valueIn, 0),
        valueOut: payloadRows.reduce((sum, row) => sum + row.valueOut, 0),
      },
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลด Stock Ledger ไม่ได้', 500)
  }
}
