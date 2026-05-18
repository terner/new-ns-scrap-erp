import { errorJson, type MasterDataRouteProps } from '@/lib/server/master-data'
import { patchSimpleMasterData } from '@/lib/server/simple-master-tables'

export const runtime = 'nodejs'

export async function PATCH(request: Request, props: MasterDataRouteProps) {
  try {
    const { id } = await props.params
    return await patchSimpleMasterData(request, 'productionOutputCategories', id)
  } catch (caught) {
    return errorJson(caught, 'อัปเดตสถานะหมวดหมู่ผลผลิตไม่ได้')
  }
}
