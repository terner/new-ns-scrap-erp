import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { currentActor, normalizeDate, toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'
import { averageCostForStock, quantityForStock, stockReferenceData } from '@/lib/server/stock'
import { statusConvertFormSchema } from '@/lib/stock'

export const runtime = 'nodejs'

async function nextDocNo() {
  const prefix = 'SC-'
  const last = await prisma.stock_ledger.findFirst({
    orderBy: { ref_no: 'desc' },
    select: { ref_no: true },
    where: { ref_no: { startsWith: prefix }, ref_type: 'SC' },
  })
  const lastNumber = Number(String(last?.ref_no ?? '').slice(prefix.length))
  return `${prefix}${String(Number.isFinite(lastNumber) ? lastNumber + 1 : 1).padStart(6, '0')}`
}

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'stock.ledger.view')
    const [reference, rows] = await Promise.all([
      stockReferenceData(),
      prisma.stock_ledger.findMany({
        include: { branches: true, products: true, warehouses: true },
        orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
        take: 500,
        where: { ref_type: 'SC', qty_out: { gt: 0 } },
      }),
    ])

    return NextResponse.json({
      reference,
      rows: rows.map((row) => ({
        branchName: row.branches?.name ?? '-',
        date: toDateOnly(row.date),
        id: row.ref_id ?? row.id,
        lotNo: row.lot_no ?? '',
        note: row.notes ?? '',
        productCode: row.products?.code ?? '',
        productName: row.products?.name ?? '-',
        qty: toNumber(row.qty_out),
        refNo: row.ref_no ?? '',
        statusFrom: row.output_category ?? '',
        statusTo: row.note ?? '',
        unitCost: toNumber(row.unit_cost),
        value: toNumber(row.value_out),
        createdBy: row.created_by ?? '',
        warehouseName: row.warehouses?.name ?? '-',
      })),
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดรายการปรับสถานะไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'stock.ledger.view')
    const values = statusConvertFormSchema.parse(await request.json())
    const availableQty = await quantityForStock({
      branchId: values.branchId,
      lotNo: values.lotNo,
      productId: values.productId,
      status: values.fromStatus,
      warehouseId: values.warehouseId,
    })
    if (values.qty > availableQty + 0.000001) {
      return NextResponse.json({ error: `จำนวนเกินสต๊อกที่มี (${availableQty.toLocaleString('th-TH')})` }, { status: 400 })
    }

    const unitCost = await averageCostForStock({ branchId: values.branchId, lotNo: values.lotNo, productId: values.productId, warehouseId: values.warehouseId })
    const value = values.qty * unitCost
    const refId = `SC-${randomUUID()}`
    const refNo = values.docNo ?? await nextDocNo()
    const actor = currentActor(context)

    await prisma.stock_ledger.createMany({
      data: [
        {
          branch_id: values.branchId,
          created_by: actor,
          date: normalizeDate(values.date),
          id: `SL-SC-${randomUUID()}`,
          lot_no: values.lotNo,
          movement_type: 'STATUS_CONVERT_OUT',
          note: values.toStatus,
          notes: values.reason ?? values.notes,
          output_category: values.fromStatus,
          product_id: values.productId,
          qty_in: 0,
          qty_out: values.qty,
          ref_id: refId,
          ref_no: refNo,
          ref_type: 'SC',
          unit_cost: unitCost,
          value_in: 0,
          value_out: value,
          warehouse_id: values.warehouseId,
        },
        {
          branch_id: values.branchId,
          created_by: actor,
          date: normalizeDate(values.date),
          id: `SL-SC-${randomUUID()}`,
          lot_no: values.lotNo,
          movement_type: 'STATUS_CONVERT_IN',
          note: values.fromStatus,
          notes: values.reason ?? values.notes,
          output_category: values.toStatus,
          product_id: values.productId,
          qty_in: values.qty,
          qty_out: 0,
          ref_id: refId,
          ref_no: refNo,
          ref_type: 'SC',
          unit_cost: unitCost,
          value_in: value,
          value_out: 0,
          warehouse_id: values.warehouseId,
        },
      ],
    })

    return NextResponse.json({ id: refId, refNo })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'บันทึกปรับสถานะไม่ได้', 400)
  }
}
