import { z } from 'zod'
import { prisma } from '@/lib/server/prisma'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { errorJson, masterDataJson, masterDataListJson, nextSequentialCode, normalizeCode, parseMasterDataForm, toIso, toNumber } from '@/lib/server/master-data'

export const runtime = 'nodejs'

type AccountRow = Awaited<ReturnType<typeof prisma.accounts.findMany>>[number] & {
  branches?: { name: string } | null
}

const accountTypeSchema = z.enum(['cash', 'bank', 'other'])

function mapAccount(row: AccountRow) {
  return {
    id: row.id,
    code: row.code ?? row.id,
    name: row.name,
    active: row.active ?? true,
    type: row.type,
    phone: null,
    email: null,
    note: null,
    symbol: null,
    rateToThb: null,
    parentId: null,
    channelType: null,
    bankName: row.bank_name ?? row.bank,
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

async function getNextCode() {
  const last = await prisma.accounts.findFirst({ where: { code: { startsWith: 'ACC' } }, orderBy: { code: 'desc' }, select: { code: true } })
  return nextSequentialCode(last?.code, 'ACC')
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

    const rows = await prisma.accounts.findMany({ include: { branches: true }, orderBy: [{ code: 'asc' }, { name: 'asc' }] })
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

    const values = parseMasterDataForm(await request.json())
    const code = normalizeCode(values.code, values.id || await getNextCode())
    const accountType = accountTypeSchema.parse(values.type || 'bank')
    await assertActiveBankName(values.bankName)
    const row = await prisma.accounts.upsert({
      where: { id: values.id || code },
      create: {
        id: values.id || code,
        code,
        name: values.name,
        type: accountType,
        bank_name: values.bankName || null,
        bank: values.bankName || null,
        account_no: values.accountNo || null,
        currency: values.currency || 'THB',
        opening_balance: values.openingBalance,
        od_limit: values.odLimit,
        branch_id: values.branchId || null,
        active: values.active,
      },
      update: {
        code,
        name: values.name,
        type: accountType,
        bank_name: values.bankName || null,
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
