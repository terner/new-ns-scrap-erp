import { z } from 'zod'
import { prisma } from '@/lib/server/prisma'
import { accountMasterDataFormSchema } from '@/lib/master-data'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { errorJson, masterDataJson, masterDataListJson, nextSequentialCode, toIso, toNumber } from '@/lib/server/master-data'

export const runtime = 'nodejs'

type AccountRow = Awaited<ReturnType<typeof prisma.accounts.findMany>>[number] & {
  branches?: { name: string } | null
}

const accountTypeSchema = z.enum(['cash', 'bank'])
const accountSubtypeSchema = z.enum(['cash', 'savings', 'current', 'fcd', 'od'])

function accountTypeLabel(type: string | null | undefined) {
  if (type === 'cash') return 'เงินสด'
  if (type === 'bank') return 'เงินโอน'
  return type ?? null
}

function normalizeAccountSubtype(row: { currency?: string | null; od_limit?: unknown; subtype?: string | null; type?: string | null }) {
  if (row.subtype === 'savings' || row.subtype === 'current' || row.subtype === 'cash' || row.subtype === 'fcd' || row.subtype === 'od') return row.subtype
  if (row.subtype === 'bank' || row.subtype === 'other') return 'savings'
  if (row.type === 'cash') return 'cash'
  if (Number(row.od_limit ?? 0) > 0) return 'od'
  if (String(row.currency ?? 'THB').toUpperCase() !== 'THB') return 'fcd'
  if (row.type === 'bank' || row.type === 'other') return 'savings'
  return 'savings'
}

function accountSubtypeLabel(row: { currency?: string | null; od_limit?: unknown; subtype?: string | null; type?: string | null }) {
  const subtype = normalizeAccountSubtype(row)
  if (subtype === 'cash') return 'เงินสด'
  if (subtype === 'savings') return 'ออมทรัพย์'
  if (subtype === 'current') return 'กระแสรายวัน'
  if (subtype === 'fcd') return 'FCD'
  if (subtype === 'od') return 'OD'
  return subtype
}

function normalizeAccountTypeFromSubtype(type: string, subtype: z.infer<typeof accountSubtypeSchema>) {
  if (subtype === 'cash') return 'cash'
  if (subtype === 'savings' || subtype === 'current' || subtype === 'fcd' || subtype === 'od') return 'bank'
  return type
}

function validateAccountBusinessRules(values: {
  accountNo: string | null
  bankName: string | null
  branchId: string | null
  currency: string | null
  odLimit: number | null
  subtype: z.infer<typeof accountSubtypeSchema>
}) {
  const currency = String(values.currency ?? '').trim().toUpperCase()

  if (!values.branchId) {
    throw new Error('เลือกสาขา')
  }

  if (!values.currency) {
    throw new Error('กรอกสกุลเงิน')
  }

  if (values.subtype !== 'cash') {
    if (!values.bankName) throw new Error('เลือกธนาคาร')
    if (!values.accountNo) throw new Error('กรอกเลขที่บัญชี')
  }

  if (values.subtype === 'fcd' && currency === 'THB') {
    throw new Error('บัญชี FCD ต้องใช้สกุลเงินที่ไม่ใช่ THB')
  }

  if ((values.subtype === 'savings' || values.subtype === 'current' || values.subtype === 'od') && currency && currency !== 'THB') {
    throw new Error('บัญชีประเภทนี้ต้องใช้สกุลเงิน THB')
  }

  if (values.subtype === 'od' && (!values.odLimit || values.odLimit <= 0)) {
    throw new Error('กรอกวงเงิน OD มากกว่า 0')
  }
}

function mapAccount(row: AccountRow) {
  return {
    id: row.id,
    code: null,
    name: row.name,
    active: row.active ?? true,
    type: row.type,
    typeLabel: accountTypeLabel(row.type),
    subtype: normalizeAccountSubtype(row),
    subtypeLabel: accountSubtypeLabel(row),
    phone: null,
    email: null,
    note: null,
    symbol: null,
    rateToThb: null,
    parentId: null,
    channelType: null,
    bankName: row.bank_name ?? row.bank,
    bankBranch: row.bank_branch,
    accountNo: row.account_no,
    currency: row.currency,
    openingBalance: toNumber(row.opening_balance),
    odLimit: toNumber(row.od_limit),
    branchId: row.branch_id,
    branchName: row.branches?.name ?? row.branch_id,
    address: null,
    commissionPct: null,
    baseSalary: null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }
}

async function getNextAccountId() {
  const last = await prisma.accounts.findFirst({ where: { id: { startsWith: 'ACC' } }, orderBy: { id: 'desc' }, select: { id: true } })
  return nextSequentialCode(last?.id, 'ACC')
}

async function assertActiveBankName(bankName: string | null) {
  if (!bankName) return

  const bank = await prisma.bank_names.findFirst({
    select: { id: true },
    where: {
      active: true,
      name: bankName,
    },
  })

  if (!bank) {
    throw new Error('ชื่อธนาคารที่เลือกไม่ถูกต้องหรือถูกปิดใช้งาน')
  }
}

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'master.reference.view')

    const rows = await prisma.accounts.findMany({ include: { branches: true }, orderBy: [{ name: 'asc' }, { account_no: 'asc' }] })
    return masterDataListJson(rows.map(mapAccount))
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return errorJson(caught, 'โหลดข้อมูลบัญชีเงินไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'master.reference.manage')

    const values = accountMasterDataFormSchema.parse(await request.json())
    const id = values.id || await getNextAccountId()
    const accountSubtype = accountSubtypeSchema.parse(values.subtype || (values.type || 'bank'))
    const accountType = accountTypeSchema.parse(normalizeAccountTypeFromSubtype(values.type || 'bank', accountSubtype))
    validateAccountBusinessRules({
      accountNo: values.accountNo,
      bankName: values.bankName,
      branchId: values.branchId,
      currency: values.currency,
      odLimit: values.odLimit,
      subtype: accountSubtype,
    })
    await assertActiveBankName(values.bankName)
    const row = await prisma.accounts.upsert({
      where: { id },
      create: {
        id,
        name: values.name,
        type: accountType,
        subtype: accountSubtype,
        bank_name: values.bankName || null,
        bank_branch: values.bankBranch || null,
        bank: values.bankName || null,
        account_no: values.accountNo || null,
        currency: values.currency || 'THB',
        opening_balance: values.openingBalance,
        od_limit: values.odLimit,
        branch_id: values.branchId || null,
        active: values.active,
      },
      update: {
        name: values.name,
        type: accountType,
        subtype: accountSubtype,
        bank_name: values.bankName || null,
        bank_branch: values.bankBranch || null,
        bank: values.bankName || null,
        account_no: values.accountNo || null,
        currency: values.currency || 'THB',
        opening_balance: values.openingBalance,
        od_limit: values.odLimit,
        branch_id: values.branchId || null,
        active: values.active,
      },
      include: { branches: true },
    })
    return masterDataJson(mapAccount(row))
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return errorJson(caught, 'บันทึกข้อมูลบัญชีเงินไม่ได้')
  }
}
