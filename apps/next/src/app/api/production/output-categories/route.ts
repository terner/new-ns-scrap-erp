import { errorJson } from '@/lib/server/master-data'
import { listSimpleMasterData, saveSimpleMasterData } from '@/lib/server/simple-master-tables'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return await listSimpleMasterData('productionOutputCategories')
  } catch (caught) {
    return errorJson(caught, 'โหลดข้อมูลหมวดหมู่ผลผลิตไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    return await saveSimpleMasterData(request, 'productionOutputCategories')
  } catch (caught) {
    return errorJson(caught, 'บันทึกข้อมูลหมวดหมู่ผลผลิตไม่ได้')
  }
}
