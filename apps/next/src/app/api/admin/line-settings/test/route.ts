import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'

export const runtime = 'nodejs'

const testSchema = z.object({
  token: z.string().trim().min(1, 'กรุณาระบุ Channel Access Token'),
  targetId: z.string().trim().min(1, 'กรุณาระบุ Target ID ปลายทาง'),
})

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'system.settings.manage')

    const body = await request.json()
    const { token, targetId } = testSchema.parse(body)

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: targetId,
        messages: [
          {
            type: 'text',
            text: `🔔 [ระบบ NS Scrap ERP]\n\nการเชื่อมต่อระบบ LINE Notification สำเร็จเรียบร้อยแล้ว!\n\n📅 วันที่ทดสอบ: ${new Date().toLocaleString('th-TH')}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      throw new Error(`ส่งข้อความไม่สำเร็จ (${response.status}): ${errBody}`)
    }

    return NextResponse.json({ ok: true })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'ทดสอบส่งข้อความไม่สำเร็จ', 400)
  }
}
