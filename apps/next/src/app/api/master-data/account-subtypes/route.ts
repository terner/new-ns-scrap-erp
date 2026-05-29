import { errorJson } from '@/lib/server/master-data'
import { listSimpleMasterData, saveSimpleMasterData } from '@/lib/server/simple-master-tables'

export const runtime = 'nodejs'

export async function GET() {
  try {
    return await listSimpleMasterData('accountSubtypes')
  } catch (caught) {
    return errorJson(caught, 'โหลดข้อมูลประเภทบัญชีธนาคารไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    return await saveSimpleMasterData(request, 'accountSubtypes')
  } catch (caught) {
    return errorJson(caught, 'บันทึกข้อมูลประเภทบัญชีธนาคารไม่ได้')
  }
}
