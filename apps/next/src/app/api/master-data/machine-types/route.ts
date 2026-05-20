import { listSimpleMasterData, saveSimpleMasterData } from '@/lib/server/simple-master-tables'
import { errorJson } from '@/lib/server/master-data'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return await listSimpleMasterData('machineTypes')
  } catch (caught) {
    return errorJson(caught, 'โหลดข้อมูลประเภทเครื่องจักรไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    return await saveSimpleMasterData(request, 'machineTypes')
  } catch (caught) {
    return errorJson(caught, 'บันทึกข้อมูลประเภทเครื่องจักรไม่ได้')
  }
}
