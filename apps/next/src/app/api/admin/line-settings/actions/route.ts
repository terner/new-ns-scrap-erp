import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import {
  getLineSettingsPayload,
  getLineWebhookInfo,
  lineWebhookUrl,
  sendLineTestMessage,
  setLineWebhook,
  testLineWebhook,
  verifyLineToken,
} from '@/lib/server/line-settings'

export const runtime = 'nodejs'

const actionSchema = z.object({
  action: z.enum(['verify-token', 'set-webhook', 'get-webhook', 'test-webhook', 'send-test']),
  endpoint: z.string().trim().url().optional(),
  targetId: z.string().trim().optional(),
})

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'system.settings.manage')

    const origin = new URL(request.url).origin
    const body = actionSchema.parse(await request.json())
    const endpoint = body.endpoint || lineWebhookUrl(origin)
    let result: unknown = null

    if (body.action === 'verify-token') {
      result = await verifyLineToken()
    }
    if (body.action === 'set-webhook') {
      await setLineWebhook(endpoint)
      result = await getLineWebhookInfo()
    }
    if (body.action === 'get-webhook') {
      result = await getLineWebhookInfo()
    }
    if (body.action === 'test-webhook') {
      result = await testLineWebhook(endpoint)
    }
    if (body.action === 'send-test') {
      result = await sendLineTestMessage(body.targetId)
    }

    return NextResponse.json({
      result,
      state: await getLineSettingsPayload(origin),
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'สั่งงาน LINE ไม่สำเร็จ', 400)
  }
}
