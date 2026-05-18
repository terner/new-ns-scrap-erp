import { errorJson } from '@/lib/server/master-data'
import { listSimpleMasterData, saveSimpleMasterData } from '@/lib/server/simple-master-tables'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return await listSimpleMasterData('productUnits')
  } catch (caught) {
    return errorJson(caught, 'โหลดข้อมูลหน่วยสินค้าไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    return await saveSimpleMasterData(request, 'productUnits')
  } catch (caught) {
    return errorJson(caught, 'บันทึกข้อมูลหน่วยสินค้าไม่ได้')
  }
}
