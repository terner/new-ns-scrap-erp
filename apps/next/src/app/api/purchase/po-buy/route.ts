import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

type PoItem = {
  productId?: string
  productName?: string
  qty?: number | string
  unitPrice?: number | string
  remainingQty?: number | string
}

function jsonNumber(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return toNumber(value as { toNumber: () => number } | null | undefined)
}

function itemsFromPo(row: {
  items: unknown
  product_id: string | null
  qty: unknown
  remaining_qty: unknown
  unit_price: unknown
}, productName: string) {
  if (Array.isArray(row.items) && row.items.length) {
    return row.items
      .filter((item): item is PoItem => typeof item === 'object' && item !== null)
      .map((item) => ({
        productId: item.productId ?? '',
        productName: item.productName ?? productName,
        qty: jsonNumber(item.qty),
        remainingQty: jsonNumber(item.remainingQty ?? item.qty),
        unitPrice: jsonNumber(item.unitPrice),
      }))
  }

  return [{
    productId: row.product_id ?? '',
    productName,
    qty: jsonNumber(row.qty),
    remainingQty: jsonNumber(row.remaining_qty ?? row.qty),
    unitPrice: jsonNumber(row.unit_price),
  }]
}

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const poRows = await prisma.po_buys.findMany({
      include: { suppliers: true },
      orderBy: [{ date: 'desc' }, { doc_no: 'desc' }],
      take: 5000,
    })
    const productIds = [...new Set(poRows.map((row) => row.product_id).filter(Boolean) as string[])]
    const products = productIds.length ? await prisma.products.findMany({ where: { id: { in: productIds } } }) : []
    const productById = new Map(products.map((product) => [product.id, product]))

    const rows = poRows.map((po) => {
      const productName = po.product_id ? productById.get(po.product_id)?.name ?? po.product_id : ''
      const items = itemsFromPo(po, productName)
      const qty = items.reduce((sum, item) => sum + item.qty, 0) || toNumber(po.qty)
      const remainingQty = items.reduce((sum, item) => sum + item.remainingQty, 0) || toNumber(po.remaining_qty)
      const totalAmount = toNumber(po.total_amount) || items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
      const remainingAmount = toNumber(po.remaining_amount) || items.reduce((sum, item) => sum + item.remainingQty * item.unitPrice, 0)

      return {
        createdBy: po.created_by ?? '',
        date: toDateOnly(po.date),
        docNo: po.doc_no,
        expectedDelivery: toDateOnly(po.expected_delivery),
        id: po.id,
        itemCount: items.length,
        items,
        purpose: po.purpose ?? '',
        qty,
        remainingAmount,
        remainingQty,
        requireDelivery: po.require_delivery !== false,
        status: po.status ?? 'Open',
        supplierId: po.supplier_id ?? '',
        supplierName: po.suppliers?.name ?? po.supplier_id ?? '-',
        totalAmount,
      }
    })

    return NextResponse.json({
      rows,
      summary: {
        costingOnly: rows.filter((row) => !row.requireDelivery).length,
        delivery: rows.filter((row) => row.requireDelivery).length,
        open: rows.filter((row) => !['Cancelled', 'cancelled', 'Received', 'received'].includes(row.status)).length,
        remainingAmount: rows.reduce((sum, row) => sum + row.remainingAmount, 0),
        remainingQty: rows.reduce((sum, row) => sum + row.remainingQty, 0),
        totalAmount: rows.reduce((sum, row) => sum + row.totalAmount, 0),
        totalRows: rows.length,
      },
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลด PO Buy ไม่ได้', 500)
  }
}
