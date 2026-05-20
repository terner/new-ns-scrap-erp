import { patchSimpleMasterData } from '@/lib/server/simple-master-tables'
import { errorJson, type MasterDataRouteProps } from '@/lib/server/master-data'

export const runtime = 'nodejs'

export async function PATCH(request: Request, { params }: MasterDataRouteProps) {
  try {
    const { id } = await params
    return await patchSimpleMasterData(request, 'machineTypes', id)
  } catch (caught) {
    return errorJson(caught, 'อัปเดตสถานะประเภทเครื่องจักรไม่ได้')
  }
}
