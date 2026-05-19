import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'
import { applyWorksheetTableLayout } from '@/lib/server/xlsx'

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
}, productById: Map<string, { id: string; name: string | null }>, productName: string) {
  if (Array.isArray(row.items) && row.items.length) {
    return row.items
      .filter((item): item is PoItem => typeof item === 'object' && item !== null)
      .map((item) => ({
        productId: item.productId ?? '',
        productName: item.productName ?? (item.productId ? productById.get(item.productId)?.name : null) ?? productName,
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

function buildWorkbook(rows: Array<Record<string, string | number>>) {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows)
  const headers = rows[0] ? Object.keys(rows[0]) : []
  sheet['!cols'] = headers.map((header) => ({ wch: Math.max(12, header.length + 4) }))
  applyWorksheetTableLayout(sheet, headers.length, rows.length + 1)
  XLSX.utils.book_append_sheet(workbook, sheet, 'PO Buy')
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer
}

function xlsxResponse(body: Buffer, filename: string) {
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  })
}

function dateInRange(date: string, from: string | null, to: string | null) {
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}

export async function GET(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.trim().toLowerCase()
    const statusFilter = url.searchParams.get('status')
    const purposeFilter = url.searchParams.get('purpose')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    const activeStatusFilter = statusFilter && statusFilter !== 'all' ? statusFilter : null
    const activePurposeFilter = purposeFilter && purposeFilter !== 'all' ? purposeFilter : null

    const poRows = await prisma.po_buys.findMany({
      include: { suppliers: true },
      orderBy: [{ date: 'desc' }, { doc_no: 'desc' }],
      take: 5000,
    })
    const itemProductIds = poRows.flatMap((row) => Array.isArray(row.items)
      ? row.items
        .filter((item): item is PoItem => typeof item === 'object' && item !== null)
        .map((item) => item.productId)
        .filter(Boolean)
      : [])
    const productIds = [...new Set([...poRows.map((row) => row.product_id).filter(Boolean), ...itemProductIds] as string[])]
    const products = productIds.length ? await prisma.products.findMany({ where: { id: { in: productIds } } }) : []
    const productById = new Map(products.map((product) => [product.id, product]))

    const rows = poRows.map((po) => {
      const productName = po.product_id ? productById.get(po.product_id)?.name ?? po.product_id : ''
      const items = itemsFromPo(po, productById, productName)
      const qty = items.reduce((sum, item) => sum + item.qty, 0) || toNumber(po.qty)
      const remainingQty = items.reduce((sum, item) => sum + item.remainingQty, 0) || toNumber(po.remaining_qty)
      const totalAmount = toNumber(po.total_amount) || items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0)
      const remainingAmount = toNumber(po.remaining_amount) || items.reduce((sum, item) => sum + item.remainingQty * item.unitPrice, 0)
      const requireDelivery = po.require_delivery !== false
      const status = po.status ?? 'Open'

      return {
        createdBy: po.created_by ?? '',
        date: toDateOnly(po.date),
        docNo: po.doc_no,
        expectedDelivery: toDateOnly(po.expected_delivery),
        id: po.id,
        itemCount: items.length,
        items,
        productName: items.map((item) => item.productName).filter(Boolean).join(', ') || productName || '-',
        purpose: po.purpose ?? '',
        purposeLabel: requireDelivery ? 'Delivery' : 'Costing',
        qty,
        remainingAmount,
        remainingQty,
        requireDelivery,
        status,
        supplierId: po.supplier_id ?? '',
        supplierName: po.suppliers?.name ?? po.supplier_id ?? '-',
        totalAmount,
      }
    })
      .filter((row) => !activeStatusFilter || row.status === activeStatusFilter)
      .filter((row) => !activePurposeFilter || (activePurposeFilter === 'delivery' ? row.requireDelivery : !row.requireDelivery))
      .filter((row) => dateInRange(row.date, from, to))
      .filter((row) => {
        if (!q) return true
        const productText = row.items.map((item) => item.productName).join(' ')
        return `${row.docNo} ${row.supplierName} ${productText} ${row.status} ${row.purpose} ${row.purposeLabel}`.toLowerCase().includes(q)
      })

    if (url.searchParams.get('format') === 'xlsx') {
      return xlsxResponse(buildWorkbook(rows.map((row) => ({
        CreatedBy: row.createdBy,
        Date: row.date,
        DocNo: row.docNo,
        ExpectedDelivery: row.expectedDelivery,
        ItemCount: row.itemCount,
        Product: row.productName,
        Purpose: row.purposeLabel,
        Qty: row.qty,
        RemainingAmount: row.remainingAmount,
        RemainingQty: row.remainingQty,
        Status: row.status,
        Supplier: row.supplierName,
        TotalAmount: row.totalAmount,
      }))), 'po_buy.xlsx')
    }

    return NextResponse.json({
      filters: {
        statuses: Array.from(new Set(poRows.map((row) => row.status ?? 'Open'))).sort(),
      },
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
