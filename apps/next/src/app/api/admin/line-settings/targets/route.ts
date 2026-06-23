import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { getLineSettingsPayload, saveLineTarget } from '@/lib/server/line-settings'

export const runtime = 'nodejs'

const targetSchema = z.object({
  active: z.boolean().default(true),
  branchCode: z.string().trim().max(30).nullable().optional().transform((value) => value || null),
  displayName: z.string().trim().max(120).nullable().optional().transform((value) => value || null),
  id: z.string().trim().regex(/^\d+$/).optional(),
  isDefault: z.boolean().default(false),
  sendWti: z.boolean().default(true),
  sendWto: z.boolean().default(true),
  targetId: z.string().trim().min(1).max(200),
  targetType: z.enum(['group', 'room', 'user']),
})

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'system.settings.manage')

    const origin = new URL(request.url).origin
    const values = targetSchema.parse(await request.json())
    await saveLineTarget(values)

    return NextResponse.json(await getLineSettingsPayload(origin))
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'บันทึก LINE target ไม่สำเร็จ', 400)
  }
}
