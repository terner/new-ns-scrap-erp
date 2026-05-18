import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

const listAuthEventsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

type AuthEventRow = {
  actor_display_name: string | null
  actor_username: string | null
  created_at: Date
  event_type: string
  id: string
  metadata: unknown
  target_display_name: string | null
  target_username: string | null
  user_agent: string | null
}

export async function GET(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'system.audit.view')

    const url = new URL(request.url)
    const values = listAuthEventsSchema.parse({
      limit: url.searchParams.get('limit') ?? undefined,
    })

    const rows = await prisma.$queryRaw<AuthEventRow[]>`
      select
        e.id,
        e.event_type,
        e.metadata,
        e.user_agent,
        e.created_at,
        actor.username as actor_username,
        actor.display_name as actor_display_name,
        target.username as target_username,
        target.display_name as target_display_name
      from public.app_auth_events e
      left join public.app_users actor on actor.id = e.actor_app_user_id
      left join public.app_users target on target.id = e.target_app_user_id
      order by e.created_at desc
      limit ${values.limit}
    `

    return NextResponse.json({
      rows: rows.map((row) => ({
        actor: row.actor_username ? {
          displayName: row.actor_display_name,
          username: row.actor_username,
        } : null,
        createdAt: row.created_at.toISOString(),
        eventType: row.event_type,
        id: row.id,
        metadata: row.metadata,
        target: row.target_username ? {
          displayName: row.target_display_name,
          username: row.target_username,
        } : null,
        userAgent: row.user_agent,
      })),
    })
  } catch (caught) {
    return authContextErrorResponse(caught)
  }
}
