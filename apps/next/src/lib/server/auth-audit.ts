import type { AppAuthContext } from '@/lib/server/auth-context'
import { prisma } from '@/lib/server/prisma'

type AuthAuditEvent = {
  context: AppAuthContext
  eventType: string
  metadata?: Record<string, boolean | number | string | null>
  request?: Request
  targetAppUserId?: string | null
}

function requestIp(request: Request | undefined) {
  const forwardedFor = request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const realIp = request?.headers.get('x-real-ip')?.trim()
  const candidate = forwardedFor || realIp

  if (!candidate) {
    return null
  }

  if (!/^[0-9a-fA-F:.]+$/.test(candidate)) {
    return null
  }

  return candidate
}

export async function recordAuthAuditEvent({ context, eventType, metadata = {}, request, targetAppUserId = null }: AuthAuditEvent) {
  try {
    await prisma.$executeRaw`
      insert into public.app_auth_events (
        actor_app_user_id,
        actor_auth_user_id,
        target_app_user_id,
        event_type,
        metadata,
        ip_address,
        user_agent
      ) values (
        ${context.appUser?.id ?? null}::uuid,
        ${context.authUser.id}::uuid,
        ${targetAppUserId}::uuid,
        ${eventType},
        ${JSON.stringify(metadata)}::jsonb,
        ${requestIp(request)}::inet,
        ${request?.headers.get('user-agent') ?? null}
      )
    `
  } catch (caught) {
    console.warn('Failed to record auth audit event', caught)
  }
}
