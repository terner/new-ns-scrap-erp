import { prisma } from '@/lib/server/prisma'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { errorJson, masterDataJson, type MasterDataRouteProps, updateMasterDataStatusSchema, toIso, toNumber } from '@/lib/server/master-data'

export const runtime = 'nodejs'

export async function PATCH(request: Request, { params }: MasterDataRouteProps) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'master.products.status')

    const { id } = await params
    const values = updateMasterDataStatusSchema.parse(await request.json())
    const row = await prisma.products.update({ where: { id }, data: { active: values.active } })
    return masterDataJson({ id: row.id, code: row.code, name: row.name, active: row.active ?? true, type: row.type, unit: row.unit, metalGroup: row.metal_group, itemStatus: row.item_status, grade: row.grade, stdPrice: toNumber(row.std_price), stdCost: toNumber(row.std_cost), createdAt: toIso(row.created_at), updatedAt: toIso(row.updated_at) })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return errorJson(caught, 'อัปเดตสถานะสินค้าไม่ได้')
  }
}
