import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'

export const runtime = 'nodejs'

const testConnectionSchema = z.object({
  token: z.string().trim().min(1, 'กรุณาระบุ Channel Access Token'),
})

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'system.settings.manage')

    const body = await request.json()
    const { token } = testConnectionSchema.parse(body)

    const response = await fetch('https://api.line.me/v2/bot/info', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`เชื่อมต่อไม่สำเร็จ (${response.status}): ${errText}`)
    }

    const botInfo = await response.json() as {
      displayName: string
      basicId: string
      pictureUrl?: string
    }

    return NextResponse.json({
      ok: true,
      botName: botInfo.displayName,
      basicId: botInfo.basicId,
      pictureUrl: botInfo.pictureUrl || null,
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'ตรวจสอบการเชื่อมต่อ LINE OA ล้มเหลว', 400)
  }
}
