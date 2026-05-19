import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { currentActor, normalizeDate, toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'
import { averageCostForStock, quantityForStock, stockReferenceData } from '@/lib/server/stock'
import { customerReturnFormSchema } from '@/lib/stock'

export const runtime = 'nodejs'

async function nextDocNo() {
  const prefix = 'CR-'
  const last = await prisma.stock_ledger.findFirst({
    orderBy: { ref_no: 'desc' },
    select: { ref_no: true },
    where: { ref_no: { startsWith: prefix }, ref_type: 'CR' },
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
        take: 1000,
        where: { ref_type: 'CR' },
      }),
    ])
    const customers = await prisma.customers.findMany({
      where: { id: { in: rows.map((row) => row.return_customer_id).filter((id): id is string => Boolean(id)) } },
    })
    const customerById = new Map(customers.map((row) => [row.id, row]))
    const grouped = new Map<string, {
      branchId: string
      branchName: string
      customerName: string
      id: string
      lastDate: string
      lotNo: string
      productCode: string
      productId: string
      productName: string
      qty: number
      reason: string
      sentQty: number
      value: number
      warehouseId: string
      warehouseName: string
    }>()
    for (const row of rows) {
      const key = `${row.product_id ?? ''}|${row.branch_id ?? ''}|${row.warehouse_id ?? ''}|${row.lot_no ?? ''}|${row.return_customer_id ?? ''}`
      const current = grouped.get(key) ?? {
        branchId: row.branch_id ?? '',
        branchName: row.branches?.name ?? '-',
        customerName: row.return_customer_id ? customerById.get(row.return_customer_id)?.name ?? '-' : '-',
        id: key,
        lastDate: toDateOnly(row.date),
        lotNo: row.lot_no ?? '',
        productCode: row.products?.code ?? '',
        productId: row.product_id ?? '',
        productName: row.products?.name ?? '-',
        qty: 0,
        reason: row.return_reason ?? row.notes ?? '',
        sentQty: 0,
        value: 0,
        warehouseId: row.warehouse_id ?? '',
        warehouseName: row.warehouses?.name ?? '-',
      }
      current.qty += toNumber(row.qty_in) - toNumber(row.qty_out)
      current.sentQty += toNumber(row.qty_out)
      current.value += toNumber(row.value_in) - toNumber(row.value_out)
      current.lastDate = toDateOnly(row.date)
      grouped.set(key, current)
    }

    return NextResponse.json({
      reference,
      rows: Array.from(grouped.values()).filter((row) => row.qty > 0.000001 || row.sentQty > 0).sort((a, b) => b.value - a.value),
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดของคืนลูกค้าไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'stock.ledger.view')
    const values = customerReturnFormSchema.parse(await request.json())
    const refNo = values.docNo ?? await nextDocNo()
    const refId = `CR-${randomUUID()}`
    const actor = currentActor(context)
    const unitCost = values.unitCost || await averageCostForStock({ branchId: values.branchId, lotNo: values.lotNo, productId: values.productId, warehouseId: values.warehouseId })

    if (values.action === 'send_back') {
      const availableQty = await quantityForStock({
        branchId: values.branchId,
        lotNo: values.lotNo,
        productId: values.productId,
        warehouseId: values.warehouseId,
      })
      if (values.qty > availableQty + 0.000001) {
        return NextResponse.json({ error: `จำนวนเกินของคืนที่มี (${availableQty.toLocaleString('th-TH')})` }, { status: 400 })
      }
    }

    await prisma.stock_ledger.create({
      data: {
        branch_id: values.branchId,
        created_by: actor,
        date: normalizeDate(values.date),
        id: `SL-CR-${randomUUID()}`,
        lot_no: values.lotNo,
        movement_type: values.action === 'send_back' ? 'CUSTOMER_RETURN_SEND_BACK' : 'CUSTOMER_RETURN_IN',
        not_available_for_sale: true,
        notes: values.notes ?? values.deliveryRefNo,
        product_id: values.productId,
        qty_in: values.action === 'receive' ? values.qty : 0,
        qty_out: values.action === 'send_back' ? values.qty : 0,
        ref_id: refId,
        ref_no: refNo,
        ref_type: 'CR',
        return_customer_id: values.customerId,
        return_reason: values.reason,
        unit_cost: unitCost,
        value_in: values.action === 'receive' ? values.qty * unitCost : 0,
        value_out: values.action === 'send_back' ? values.qty * unitCost : 0,
        warehouse_id: values.warehouseId,
      },
    })

    return NextResponse.json({ id: refId, refNo })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'บันทึกของคืนลูกค้าไม่ได้', 400)
  }
}
