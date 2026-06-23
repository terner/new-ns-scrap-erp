import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { branchScopeIds, enteredByLabel } from '@/lib/server/weight-tickets'
import { notifyWeightTicketLine } from '@/lib/server/weight-ticket-line-notification'

export const runtime = 'nodejs'

const notifySchema = z.object({
  customMessage: z.string().trim().max(500).optional().default(''),
  targetId: z.string().trim().max(160).optional().default(''),
})

function requestOrigin(request: Request) {
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const configured = process.env.NEXT_PUBLIC_APP_URL
  if (configured) return configured.replace(/\/$/, '')
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`
  return new URL(request.url).origin
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getCurrentAuthContext()
    requirePermission(auth, 'finance.cash.view')

    const { id } = await context.params
    const body = notifySchema.parse(await request.json().catch(() => ({})))
    const result = await notifyWeightTicketLine(id, {
      customMessage: body.customMessage || undefined,
      origin: requestOrigin(request),
      requestedBy: enteredByLabel(auth),
      scopedBranchIds: branchScopeIds(auth),
      targetId: body.targetId || undefined,
    })

    if (result.status !== 200) {
      return NextResponse.json({ code: result.code, error: result.error }, { status: result.status })
    }

    return NextResponse.json(result)
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'ส่ง LINE ใบรับ-ส่งของไม่สำเร็จ', 500)
  }
}
