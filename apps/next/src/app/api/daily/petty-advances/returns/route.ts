import { NextResponse } from 'next/server'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.cash.view')

    return NextResponse.json({
      code: 'PETTY_ADVANCE_RETURN_DISABLED',
      error: 'ยกเลิก flow PRET แล้ว ให้ส่งรายการ PADV ไปอนุมัติที่หน้า Payment Approval และจ่ายผ่าน PMA/PMT เท่านั้น',
    }, { status: 410 })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return NextResponse.json({ code: 'SERVER_ERROR', error: 'ตรวจสอบสิทธิ์ไม่ได้' }, { status: 500 })
  }
}
