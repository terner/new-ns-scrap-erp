import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supplierFormSchema } from '@/lib/supplier'
import { toSupplierWriteInput } from '@/lib/domain/supplier'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

const IMPORT_LIMIT = 10000
const MAX_FILE_SIZE = 10 * 1024 * 1024

const headerMap = {
  accountNo: ['เลขที่บัญชีรับเงิน', 'เลขบัญชี', 'accountNo'],
  active: ['สถานะ', 'active'],
  address: ['ที่อยู่เต็ม/หมายเหตุที่อยู่', 'ที่อยู่', 'address'],
  addressCountry: ['ประเทศ', 'addressCountry'],
  addressDistrict: ['อำเภอ/เขต', 'อำเภอ', 'เขต', 'addressDistrict'],
  addressMoo: ['หมู่', 'addressMoo'],
  addressNo: ['บ้านเลขที่', 'addressNo'],
  addressPostalCode: ['รหัสไปรษณีย์', 'addressPostalCode'],
  addressProvince: ['จังหวัด', 'addressProvince'],
  addressRoad: ['ถนน', 'addressRoad'],
  addressSubdistrict: ['ตำบล/แขวง', 'ตำบล', 'แขวง', 'addressSubdistrict'],
  addressVillage: ['หมู่บ้าน/อาคาร', 'หมู่บ้าน', 'อาคาร', 'addressVillage'],
  bankAccount: ['ชื่อบัญชีรับเงิน', 'bankAccount'],
  bankName: ['ธนาคารรับเงิน', 'bankName'],
  code: ['รหัสผู้ขาย', 'code'],
  creditLimit: ['วงเงินเครดิต', 'creditLimit'],
  creditTerm: ['เครดิตเทอม (วัน)', 'เครดิตเทอม', 'creditTerm'],
  firstName: ['ชื่อ', 'firstName'],
  lastName: ['นามสกุล', 'lastName'],
  marketScope: ['ประเทศ/ตลาด', 'marketScope'],
  name: ['ชื่อผู้ขาย/บริษัท', 'ชื่อบริษัท/ร้านค้า', 'name'],
  nameTitle: ['คำนำหน้าชื่อ', 'nameTitle'],
  notes: ['หมายเหตุ', 'notes'],
  phone: ['โทรศัพท์', 'โทร', 'phone'],
  salesName: ['ผู้ดูแล', 'salesName', 'salesId'],
  taxId: ['เลขผู้เสียภาษี', 'taxId'],
  type: ['ประเภทผู้ขาย', 'ประเภท', 'type'],
} as const

type ImportField = keyof typeof headerMap
type ImportRow = Record<string, unknown>

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function getCell(row: ImportRow, field: ImportField) {
  for (const label of headerMap[field]) {
    if (label in row) return row[label]
    const matchedKey = Object.keys(row).find((key) => normalizeHeader(key) === normalizeHeader(label))
    if (matchedKey) return row[matchedKey]
  }
  return ''
}

function cellText(row: ImportRow, field: ImportField) {
  const value = getCell(row, field)
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

function cellNumber(row: ImportRow, field: ImportField) {
  const value = getCell(row, field)
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const normalized = String(value).replace(/,/g, '').trim()
  if (!normalized) return null
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function normalizeSupplierCode(value: string) {
  const matched = value.trim().toLowerCase().match(/^(?:su|sup|s)(\d{1,5})$/)
  if (!matched) throw new Error('รหัสผู้ขายต้องเป็นรูปแบบ SU0001-SU99999')
  const number = Number(matched[1])
  if (!Number.isInteger(number) || number < 1 || number > 99999) throw new Error('รหัสผู้ขายต้องอยู่ระหว่าง SU0001-SU99999')
  return `SU${String(number).padStart(4, '0')}`
}

function normalizeSupplierType(value: string, row: ImportRow) {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'บุคคล' || normalized === 'person' || normalized === 'individual') return 'บุคคล'
  if (normalized === 'นิติบุคคล' || normalized === 'company' || normalized === 'corporate') return 'นิติบุคคล'
  return cellText(row, 'firstName') || cellText(row, 'lastName') ? 'บุคคล' : 'นิติบุคคล'
}

function normalizeMarketScope(value: string) {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'ต่างประเทศ' || normalized === 'foreign' || normalized === 'overseas') return 'ต่างประเทศ'
  return 'ในประเทศ'
}

function normalizeActive(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return true
  if (['ปิด', 'inactive', 'false', '0', 'no', 'n'].includes(normalized)) return false
  return true
}

function findSupplierSheet(workbook: XLSX.WorkBook) {
  const namedSheet = workbook.Sheets['ผู้ขาย']
  if (namedSheet) return namedSheet

  return workbook.SheetNames.map((name) => workbook.Sheets[name]).find((sheet) => {
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false })
    return rows.some((row) => row.map(String).includes('รหัสผู้ขาย'))
  })
}

function parseRows(workbook: XLSX.WorkBook) {
  const sheet = findSupplierSheet(workbook)
  if (!sheet) throw new Error('ไม่พบ sheet ผู้ขาย หรือ header รหัสผู้ขาย')
  return XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: '' })
}

function firstIssueMessage(rowNumber: number, message: string) {
  return `แถว ${rowNumber}: ${message}`
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'master.suppliers.create')

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ code: 'BAD_REQUEST', error: 'เลือกไฟล์ Excel ก่อน import' }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      return NextResponse.json({ code: 'BAD_REQUEST', error: 'รองรับเฉพาะไฟล์ .xlsx' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ code: 'BAD_REQUEST', error: 'ไฟล์ Excel ต้องไม่เกิน 10 MB' }, { status: 400 })
    }

    let rows: ImportRow[]
    try {
      const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' })
      rows = parseRows(workbook).filter((row) => Object.values(row).some((value) => String(value ?? '').trim()))
    } catch (caught) {
      return NextResponse.json({
        code: 'BAD_REQUEST',
        error: caught instanceof Error ? caught.message : 'อ่านไฟล์ Excel ไม่สำเร็จ',
      }, { status: 400 })
    }
    if (rows.length === 0) {
      return NextResponse.json({ code: 'BAD_REQUEST', error: 'ไม่พบข้อมูลผู้ขายในไฟล์' }, { status: 400 })
    }
    if (rows.length > IMPORT_LIMIT) {
      return NextResponse.json({ code: 'BAD_REQUEST', error: `Import ได้สูงสุด ${IMPORT_LIMIT.toLocaleString('th-TH')} แถวต่อครั้ง` }, { status: 400 })
    }

    const salespersons = await prisma.salespersons.findMany({
      select: { code: true, id: true, name: true },
      where: { active: { not: false } },
    })
    const salespersonLookup = new Map<string, { id: string; name: string }>()
    for (const salesperson of salespersons) {
      for (const key of [salesperson.id, salesperson.code ?? '', salesperson.name]) {
        if (key) salespersonLookup.set(key.trim().toLowerCase(), { id: salesperson.id, name: salesperson.name })
      }
    }

    const issues: string[] = []
    const seenCodes = new Set<string>()
    const parsedRows = rows.map((row, index) => {
      const rowNumber = index + 2
      let code = ''
      try {
        code = normalizeSupplierCode(cellText(row, 'code'))
      } catch (caught) {
        issues.push(firstIssueMessage(rowNumber, caught instanceof Error ? caught.message : 'รหัสผู้ขายไม่ถูกต้อง'))
      }

      if (code && seenCodes.has(code)) issues.push(firstIssueMessage(rowNumber, `รหัสผู้ขาย ${code} ซ้ำในไฟล์`))
      if (code) seenCodes.add(code)

      const salesText = cellText(row, 'salesName')
      const salesperson = salesText ? salespersonLookup.get(salesText.toLowerCase()) : null
      if (salesText && !salesperson) issues.push(firstIssueMessage(rowNumber, `ไม่พบผู้ดูแล "${salesText}" ในระบบ`))

      const values = {
        id: code || undefined,
        code: code || null,
        name: cellText(row, 'name') || null,
        nameTitle: cellText(row, 'nameTitle') || null,
        firstName: cellText(row, 'firstName') || null,
        lastName: cellText(row, 'lastName') || null,
        type: normalizeSupplierType(cellText(row, 'type'), row),
        marketScope: normalizeMarketScope(cellText(row, 'marketScope')),
        taxId: cellText(row, 'taxId') || null,
        phone: cellText(row, 'phone') || null,
        address: cellText(row, 'address') || null,
        addressNo: cellText(row, 'addressNo') || null,
        addressMoo: cellText(row, 'addressMoo') || null,
        addressVillage: cellText(row, 'addressVillage') || null,
        addressRoad: cellText(row, 'addressRoad') || null,
        addressSubdistrict: cellText(row, 'addressSubdistrict') || null,
        addressDistrict: cellText(row, 'addressDistrict') || null,
        addressProvince: cellText(row, 'addressProvince') || null,
        addressPostalCode: cellText(row, 'addressPostalCode') || null,
        addressCountry: cellText(row, 'addressCountry') || 'ไทย',
        bankName: cellText(row, 'bankName') || null,
        accountNo: cellText(row, 'accountNo') || null,
        bankAccount: cellText(row, 'bankAccount') || null,
        branchId: null,
        salesId: salesperson?.id ?? null,
        salesName: salesperson?.name ?? null,
        creditTerm: cellNumber(row, 'creditTerm'),
        creditLimit: cellNumber(row, 'creditLimit'),
        notes: cellText(row, 'notes') || null,
        active: normalizeActive(cellText(row, 'active')),
      }

      const parsed = supplierFormSchema.safeParse(values)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        issues.push(firstIssueMessage(rowNumber, issue?.message ?? 'ข้อมูลไม่ถูกต้อง'))
      }

      return parsed.success ? parsed.data : null
    })

    if (issues.length > 0) {
      return NextResponse.json({
        code: 'VALIDATION_ERROR',
        error: `Import Excel ไม่สำเร็จ: ${issues.slice(0, 5).join(', ')}`,
        issues: issues.slice(0, 50),
      }, { status: 400 })
    }

    const validRows = parsedRows.filter((row): row is NonNullable<typeof row> => row !== null)
    const codes = validRows.map((row) => row.id as string)
    const existing = await prisma.suppliers.findMany({ select: { branch_id: true, id: true }, where: { id: { in: codes } } })
    const existingIds = new Set(existing.map((row) => row.id))
    const existingBranchById = new Map(existing.map((row) => [row.id, row.branch_id]))

    await prisma.$transaction(validRows.map((row) => {
      const payload = toSupplierWriteInput(row)
      if (existingBranchById.has(payload.id)) payload.branch_id = existingBranchById.get(payload.id) ?? null
      return prisma.suppliers.upsert({
        where: { id: payload.id },
        create: payload,
        update: payload,
      })
    }))

    const updated = validRows.filter((row) => existingIds.has(row.id as string)).length
    return NextResponse.json({
      inserted: validRows.length - updated,
      totalRows: validRows.length,
      updated,
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'Import Excel ไม่สำเร็จ', 500)
  }
}
