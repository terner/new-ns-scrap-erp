import { prisma } from '@/lib/server/prisma'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { errorJson, masterDataJson, masterDataListJson, nextSequentialCode, parseMasterDataForm } from '@/lib/server/master-data'

export const runtime = 'nodejs'

type SalesChannel = Awaited<ReturnType<typeof prisma.sales_channels.findMany>>[number]

function mapChannel(row: SalesChannel) {
  return {
    id: `sales:${row.id}`,
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

async function getNextChannelId() {
  const last = await prisma.sales_channels.findFirst({ where: { id: { startsWith: 'SC' } }, orderBy: { id: 'desc' }, select: { id: true } })
  return nextSequentialCode(last?.id, 'SC')
}

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'master.reference.view')

    const salesRows = await prisma.sales_channels.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] })
    return masterDataListJson(salesRows.map(mapChannel))
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return errorJson(caught, 'โหลดข้อมูลช่องทางไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'master.reference.manage')

    const values = parseMasterDataForm(await request.json())
    const rawId = values.id?.replace(/^(purchase|sales):/, '')
    const id = rawId || await getNextChannelId()

    const row = await prisma.sales_channels.upsert({
      where: { id },
      create: { id, name: values.name, active: values.active },
      update: { name: values.name, active: values.active },
    })
    return masterDataJson(mapChannel(row))
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return errorJson(caught, 'บันทึกข้อมูลช่องทางไม่ได้')
  }
}
