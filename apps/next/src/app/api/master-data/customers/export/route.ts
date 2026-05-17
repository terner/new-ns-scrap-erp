import { NextResponse } from 'next/server'
import { mapPrismaCustomer } from '@/lib/domain/customer'
import { prisma } from '@/lib/server/prisma'
import type { Customer } from '@/lib/customer'
import type { Prisma } from '../../../../../../generated/prisma/client'

export const runtime = 'nodejs'

const EXPORT_LIMIT = 10000

const sortColumns = {
  active: 'active',
  code: 'code',
  contact: 'contact',
  creditLimit: 'credit_limit',
  creditTerm: 'credit_term',
  email: 'email',
  name: 'name',
  phone: 'phone',
  taxId: 'tax_id',
  type: 'type',
} as const

const customerColumns: Array<{ key: keyof Customer; label: string; width: number; type?: 'number' }> = [
  { key: 'code', label: 'รหัสลูกค้า', width: 90 },
  { key: 'name', label: 'ชื่อลูกค้า/บริษัท', width: 220 },
  { key: 'type', label: 'ประเภทลูกค้า', width: 110 },
  { key: 'marketScope', label: 'ประเทศ/ตลาด', width: 110 },
  { key: 'nameTitle', label: 'คำนำหน้าชื่อ', width: 100 },
  { key: 'firstName', label: 'ชื่อ', width: 140 },
  { key: 'lastName', label: 'นามสกุล', width: 140 },
  { key: 'taxId', label: 'เลขผู้เสียภาษี', width: 130 },
  { key: 'phone', label: 'โทรศัพท์', width: 130 },
  { key: 'email', label: 'อีเมล', width: 200 },
  { key: 'contact', label: 'ผู้ติดต่อ', width: 180 },
  { key: 'contactTitle', label: 'คำนำหน้าผู้ติดต่อ', width: 120 },
  { key: 'contactFirstName', label: 'ชื่อผู้ติดต่อ', width: 140 },
  { key: 'contactLastName', label: 'นามสกุลผู้ติดต่อ', width: 140 },
  { key: 'addressPostalCode', label: 'รหัสไปรษณีย์', width: 100 },
  { key: 'addressProvince', label: 'จังหวัด', width: 120 },
  { key: 'addressDistrict', label: 'อำเภอ/เขต', width: 120 },
  { key: 'addressSubdistrict', label: 'ตำบล/แขวง', width: 120 },
  { key: 'addressNo', label: 'บ้านเลขที่', width: 100 },
  { key: 'addressMoo', label: 'หมู่', width: 70 },
  { key: 'addressVillage', label: 'หมู่บ้าน/อาคาร', width: 180 },
  { key: 'addressRoad', label: 'ถนน', width: 140 },
  { key: 'addressCountry', label: 'ประเทศ', width: 100 },
  { key: 'address', label: 'ที่อยู่เต็ม/หมายเหตุที่อยู่', width: 300 },
  { key: 'creditTerm', label: 'เครดิตเทอม (วัน)', width: 110, type: 'number' },
  { key: 'creditLimit', label: 'วงเงินเครดิต', width: 120, type: 'number' },
  { key: 'active', label: 'สถานะ', width: 90 },
  { key: 'notes', label: 'หมายเหตุ', width: 240 },
  { key: 'createdAt', label: 'สร้างเมื่อ', width: 150 },
  { key: 'updatedAt', label: 'แก้ไขเมื่อ', width: 150 },
  { key: 'id', label: 'รหัสภายใน', width: 180 },
]

function parseExportParams(request: Request) {
  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim() ?? ''
  const customerType = url.searchParams.get('type')?.trim() ?? ''
  const marketScope = url.searchParams.get('marketScope')?.trim() ?? ''
  const sort = url.searchParams.get('sort') ?? 'code'
  const direction = url.searchParams.get('direction') === 'desc' ? 'desc' : 'asc'
  const sortColumn = sortColumns[sort as keyof typeof sortColumns] ?? sortColumns.code

  return { customerType, direction, marketScope, q, sortColumn }
}

function customerSearchWhere(q: string, customerType: string, marketScope: string): Prisma.customersWhereInput {
  const where: Prisma.customersWhereInput = {}

  if (customerType) {
    where.type = customerType
  }

  if (marketScope) {
    where.market_scope = marketScope
  }

  if (!q) return where

  where.OR = [
    { id: { contains: q, mode: 'insensitive' } },
    { code: { contains: q, mode: 'insensitive' } },
    { name: { contains: q, mode: 'insensitive' } },
    { type: { contains: q, mode: 'insensitive' } },
    { tax_id: { contains: q, mode: 'insensitive' } },
    { phone: { contains: q, mode: 'insensitive' } },
    { email: { contains: q, mode: 'insensitive' } },
    { address: { contains: q, mode: 'insensitive' } },
    { contact: { contains: q, mode: 'insensitive' } },
    { sales_id: { contains: q, mode: 'insensitive' } },
    { notes: { contains: q, mode: 'insensitive' } },
  ]

  return where
}

function xmlEscape(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatCellValue(customer: Customer, key: keyof Customer) {
  const value = customer[key]
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'boolean') return value ? 'ใช้งาน' : 'ปิด'
  if (typeof value === 'number') return value
  return String(value)
}

function dataCell(value: string | number, type: 'String' | 'Number' = 'String') {
  return `<Cell><Data ss:Type="${type}">${xmlEscape(String(value))}</Data></Cell>`
}

function worksheet(name: string, rows: string[], columns: Array<{ width: number }>) {
  const columnXml = columns.map((column) => `<Column ss:Width="${column.width}"/>`).join('')
  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${columnXml}${rows.join('')}</Table></Worksheet>`
}

function buildWorkbook(customers: Customer[], total: number, filters: { customerType: string; marketScope: string; q: string }) {
  const generatedAt = new Date()
  const summaryRows = [
    ['Export ณ', generatedAt.toLocaleString('th-TH')],
    ['จำนวนที่ export', customers.length.toLocaleString('th-TH')],
    ['จำนวนทั้งหมดตาม filter', total.toLocaleString('th-TH')],
    ['ค้นหา', filters.q || '-'],
    ['ประเภทลูกค้า', filters.customerType || 'ทุกประเภท'],
    ['ประเทศ/ตลาด', filters.marketScope || 'ทุกตลาด'],
  ].map((row) => `<Row>${row.map((cell) => dataCell(cell)).join('')}</Row>`)

  const headerRow = `<Row>${customerColumns.map((column) => dataCell(column.label)).join('')}</Row>`
  const dataRows = customers.map((customer) => {
    const cells = customerColumns.map((column) => {
      const value = formatCellValue(customer, column.key)
      return column.type === 'number' && typeof value === 'number' ? dataCell(value, 'Number') : dataCell(value)
    })
    return `<Row>${cells.join('')}</Row>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Top"/><Font ss:FontName="Tahoma" ss:Size="10"/></Style>
</Styles>
${worksheet('สรุป', summaryRows, [{ width: 160 }, { width: 220 }])}
${worksheet('ลูกค้า', [headerRow, ...dataRows], customerColumns)}
</Workbook>`
}

export async function GET(request: Request) {
  try {
    const { customerType, direction, marketScope, q, sortColumn } = parseExportParams(request)
    const where = customerSearchWhere(q, customerType, marketScope)
    const [rows, total] = await Promise.all([
      prisma.customers.findMany({
        orderBy: [{ [sortColumn]: direction }, { id: 'asc' }],
        take: EXPORT_LIMIT,
        where,
      }),
      prisma.customers.count({ where }),
    ])

    const customers = rows.map(mapPrismaCustomer)
    const body = buildWorkbook(customers, total, { customerType, marketScope, q })
    const filename = `customers_${new Date().toISOString().slice(0, 10)}.xls`

    return new NextResponse(body, {
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
      },
    })
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : 'Export Excel ไม่สำเร็จ' }, { status: 500 })
  }
}
