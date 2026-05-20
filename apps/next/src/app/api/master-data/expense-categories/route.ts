import { prisma } from '@/lib/server/prisma'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { errorJson, masterDataJson, masterDataListJson, nextSequentialCode, parseMasterDataForm } from '@/lib/server/master-data'

export const runtime = 'nodejs'

function mapExpenseCategory(row: Awaited<ReturnType<typeof prisma.expense_categories.findMany>>[number]) {
  return {
    id: row.id,
    code: null,
    name: row.name,
    active: row.active ?? true,
    type: null,
    phone: null,
    email: null,
    note: null,
    symbol: null,
    rateToThb: null,
    parentId: null,
    channelType: null,
    bankName: null,
    accountNo: null,
    currency: null,
    openingBalance: null,
    odLimit: null,
    branchId: null,
    branchName: null,
    address: null,
    commissionPct: null,
    baseSalary: null,
    createdAt: null,
    updatedAt: null,
  }
}

async function getNextId() {
  const last = await prisma.expense_categories.findFirst({ where: { id: { startsWith: 'EXP' } }, orderBy: { id: 'desc' }, select: { id: true } })
  return nextSequentialCode(last?.id, 'EXP')
}

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'master.reference.view')

    const rows = await prisma.expense_categories.findMany({ orderBy: { name: 'asc' } })
    return masterDataListJson(rows.map(mapExpenseCategory))
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return errorJson(caught, 'โหลดข้อมูลหมวดค่าใช้จ่ายไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'master.reference.manage')

    const values = parseMasterDataForm(await request.json())
    const id = values.id || await getNextId()
    const row = await prisma.expense_categories.upsert({
      where: { id },
      create: { id, name: values.name, active: values.active },
      update: { name: values.name, active: values.active },
    })
    return masterDataJson(mapExpenseCategory(row))
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return errorJson(caught, 'บันทึกข้อมูลหมวดค่าใช้จ่ายไม่ได้')
  }
}
