import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import * as XLSX from 'xlsx'
import { purchaseBillFormSchema, type PurchaseBillFormValues } from '@/lib/purchase-bill'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { currentActor, nextDailyDocNo, normalizeDate, toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'
import { applyWorksheetTableLayout } from '@/lib/server/xlsx'
import type { Prisma } from '../../../../../generated/prisma/client'

export const runtime = 'nodejs'

type PurchaseBillRow = Prisma.purchase_billsGetPayload<{
  include: {
    branches: true
    purchase_channels: true
    suppliers: true
    warehouses: true
  }
}>

function billJson(row: PurchaseBillRow) {
  return {
    branchId: row.branch_id ?? '',
    branchName: row.branches?.name ?? '-',
    channelId: row.channel_id ?? '',
    channelName: row.purchase_channels?.name ?? '-',
    createdAt: row.created_at?.toISOString() ?? '',
    createdBy: row.created_by ?? '-',
    date: toDateOnly(row.date),
    docNo: row.doc_no,
    hasVat: row.has_vat ?? false,
    id: row.id,
    itemCount: Array.isArray(row.items) ? row.items.length : 0,
    paidAmount: toNumber(row.paid_amount),
    payableBalance: toNumber(row.payable_balance),
    purchaseSource: row.purchase_source ?? 'SPOT_BUY',
    refNo: row.ref_no ?? '',
    status: row.status ?? 'open',
    supplierId: row.supplier_id ?? '',
    supplierName: row.suppliers?.name ?? row.supplier_id ?? '-',
    totalAmount: toNumber(row.total_amount),
    transactionMode: row.transaction_mode ?? 'STOCK',
    updatedAt: row.updated_at?.toISOString() ?? '',
    updatedBy: row.updated_by ?? '',
    vatInvoiceNo: row.vat_invoice_no ?? '',
    vatInvoiceReceived: row.vat_invoice_received ?? false,
    warehouseId: row.warehouse_id ?? '',
    warehouseName: row.warehouses?.name ?? '-',
  }
}

function calculateTotals(values: PurchaseBillFormValues) {
  const subtotal = values.items.reduce((sum, item) => sum + Math.max(0, item.qty * item.price - item.discount), 0)
  const vatAmount = !values.hasVat || values.vatType === 'NONE'
    ? 0
    : values.vatType === 'INCLUDE'
      ? subtotal * 7 / 107
      : subtotal * 0.07
  const totalAmount = values.hasVat && values.vatType === 'EXCLUDE' ? subtotal + vatAmount : subtotal

  return { subtotal, totalAmount, vatAmount }
}

async function optionsPayload() {
  const [branches, channels, products, suppliers, warehouses] = await Promise.all([
    prisma.branches.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }], select: { active: true, id: true, name: true } }),
    prisma.purchase_channels.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }], select: { active: true, id: true, name: true } }),
    prisma.products.findMany({ orderBy: [{ active: 'desc' }, { code: 'asc' }, { name: 'asc' }], select: { active: true, code: true, id: true, name: true, unit: true } }),
    prisma.suppliers.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }], select: { active: true, id: true, name: true } }),
    prisma.warehouses.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }], select: { active: true, branch_id: true, id: true, name: true } }),
  ])

  return { branches, channels, products, suppliers, warehouses }
}

async function rowsPayload() {
  const rows = await prisma.purchase_bills.findMany({
    include: {
      branches: true,
      purchase_channels: true,
      suppliers: true,
      warehouses: true,
    },
    orderBy: [{ date: 'desc' }, { doc_no: 'desc' }],
    take: 5000,
  })

  return rows.map(billJson)
}

function buildWorkbook(rows: ReturnType<typeof billJson>[]) {
  const dataRows = rows.map((row) => ({
    'เลขที่': row.docNo,
    'เลขที่อ้างอิง': row.refNo,
    'วันที่': row.date,
    'ผู้ขาย': row.supplierName,
    'สาขา': row.branchName,
    'คลัง': row.warehouseName,
    'ประเภท': row.transactionMode,
    'ที่มา': row.purchaseSource,
    'จำนวนรายการ': row.itemCount,
    'ยอดรวม': row.totalAmount,
    'ชำระแล้ว': row.paidAmount,
    'ค้างจ่าย': row.payableBalance,
    'สถานะ': row.status,
    'ใบกำกับ VAT': row.hasVat ? row.vatInvoiceReceived ? 'รับแล้ว' : 'รอรับ' : 'No VAT',
    'สร้างโดย': row.createdBy,
    'สร้างเมื่อ': row.createdAt,
  }))
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(dataRows)
  sheet['!cols'] = [
    { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 18 },
    { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 22 },
  ]
  applyWorksheetTableLayout(sheet, 16, dataRows.length + 1)
  XLSX.utils.book_append_sheet(workbook, sheet, 'บิลรับซื้อ')
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' }) as Buffer
}

export async function GET(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const url = new URL(request.url)
    const rows = await rowsPayload()

    if (url.searchParams.get('format') === 'xlsx') {
      const body = buildWorkbook(rows)
      const filename = `purchase_bills_${new Date().toISOString().slice(0, 10)}.xlsx`

      return new NextResponse(new Uint8Array(body), {
        headers: {
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      })
    }

    return NextResponse.json({
      rows,
      ...await optionsPayload(),
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดบิลรับซื้อไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    const values = purchaseBillFormSchema.parse(await request.json())
    const id = `PB-${randomUUID()}`
    const docNo = values.docNo ?? await nextDailyDocNo('purchase_bills', 'PB', values.date)
    const actor = currentActor(context)
    const totals = calculateTotals(values)

    const [supplier, branch, warehouse, channel, products] = await Promise.all([
      prisma.suppliers.findFirst({ where: { active: true, id: values.supplierId } }),
      values.branchId ? prisma.branches.findFirst({ where: { active: true, id: values.branchId } }) : Promise.resolve(null),
      values.warehouseId ? prisma.warehouses.findFirst({ where: { active: true, id: values.warehouseId } }) : Promise.resolve(null),
      values.channelId ? prisma.purchase_channels.findFirst({ where: { active: true, id: values.channelId } }) : Promise.resolve(null),
      prisma.products.findMany({ where: { active: true, id: { in: values.items.map((item) => item.productId) } } }),
    ])

    if (!supplier) return NextResponse.json({ code: 'BAD_REQUEST', error: 'ผู้ขายไม่ถูกต้องหรือถูกปิดใช้งาน' }, { status: 400 })
    if (values.branchId && !branch) return NextResponse.json({ code: 'BAD_REQUEST', error: 'สาขาไม่ถูกต้องหรือถูกปิดใช้งาน' }, { status: 400 })
    if (values.warehouseId && !warehouse) return NextResponse.json({ code: 'BAD_REQUEST', error: 'คลังไม่ถูกต้องหรือถูกปิดใช้งาน' }, { status: 400 })
    if (values.channelId && !channel) return NextResponse.json({ code: 'BAD_REQUEST', error: 'ช่องทางไม่ถูกต้องหรือถูกปิดใช้งาน' }, { status: 400 })

    const productById = new Map(products.map((product) => [product.id, product]))
    const missingProduct = values.items.find((item) => !productById.has(item.productId))
    if (missingProduct) return NextResponse.json({ code: 'BAD_REQUEST', error: 'สินค้าที่เลือกไม่ถูกต้องหรือถูกปิดใช้งาน' }, { status: 400 })

    const items = values.items.map((item) => {
      const product = productById.get(item.productId)
      const amount = Math.max(0, item.qty * item.price - item.discount)
      return {
        amount,
        discount: item.discount,
        lotNo: item.lotNo,
        note: item.note,
        price: item.price,
        productCode: product?.code ?? '',
        productId: item.productId,
        productName: product?.name ?? item.productId,
        qty: item.qty,
        unit: product?.unit ?? 'กก.',
      }
    })

    const bill = await prisma.purchase_bills.create({
      data: {
        branch_id: values.branchId,
        channel_id: values.channelId,
        created_by: actor,
        date: normalizeDate(values.date),
        doc_no: docNo,
        has_vat: values.hasVat,
        id,
        items,
        notes: values.notes,
        paid_amount: 0,
        payable_balance: totals.totalAmount,
        purchase_source: values.purchaseSource,
        ref_no: values.refNo,
        status: 'open',
        subtotal: totals.subtotal,
        supplier_id: values.supplierId,
        total_amount: totals.totalAmount,
        transaction_mode: values.transactionMode,
        updated_at: new Date(),
        updated_by: actor,
        vat_amount: totals.vatAmount,
        vat_type: values.vatType,
        warehouse_id: values.warehouseId,
      },
    })

    return NextResponse.json({ id: bill.id })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'บันทึกบิลรับซื้อไม่ได้', 400)
  }
}
