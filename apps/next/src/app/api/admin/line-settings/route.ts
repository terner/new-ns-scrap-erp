import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { currentActor } from '@/lib/server/daily'
import { getLineSettingsPayload, lineWebhookUrl, saveLineSettings } from '@/lib/server/line-settings'

export const runtime = 'nodejs'

function blankToNull(value: unknown) {
  return typeof value === 'string' && value.trim() === '' ? null : value
}

function blankToUndefined(value: unknown) {
  return typeof value === 'string' && value.trim() === '' ? undefined : value
}

const lineSettingsSchema = z.object({
  autoSendWti: z.boolean().default(false),
  autoSendWto: z.boolean().default(false),
  channelAccessToken: z.preprocess(blankToUndefined, z.string().trim().max(4096).optional()),
  channelId: z.string().trim().max(64).nullable().optional().transform((value) => value || null),
  channelSecret: z.preprocess(blankToUndefined, z.string().trim().regex(/^[a-fA-F0-9]{32}$/, 'Channel secret must be 32 hex characters').optional()),
  defaultTargetDbId: z.preprocess(blankToNull, z.string().trim().regex(/^\d+$/).nullable().optional()).transform((value) => value || null),
  pdfBucket: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._-]+$/, 'Bucket name can contain A-Z, 0-9, dot, dash, and underscore only'),
  webhookUrl: z.string().trim().url().nullable().optional().transform((value) => value || null),
})

export async function GET(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'system.settings.manage')

    const origin = new URL(request.url).origin
    return NextResponse.json(await getLineSettingsPayload(origin))
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดตั้งค่า LINE ไม่สำเร็จ', 500)
  }
}

export async function PUT(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'system.settings.manage')

    const origin = new URL(request.url).origin
    const body = await request.json()
    const values = lineSettingsSchema.parse({
      ...body,
      webhookUrl: body.webhookUrl || lineWebhookUrl(origin),
    })
    await saveLineSettings(values, currentActor(context))

    return NextResponse.json(await getLineSettingsPayload(origin))
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'บันทึกตั้งค่า LINE ไม่สำเร็จ', 400)
  }
}
