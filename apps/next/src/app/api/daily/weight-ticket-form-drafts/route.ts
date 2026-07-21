import { NextResponse } from 'next/server'
import {
  weightTicketFormDraftDeleteSchema,
  weightTicketFormDraftPayloadSchema,
  weightTicketFormDraftScopeSchema,
  weightTicketFormDraftWriteSchema,
} from '@/lib/weight-ticket-drafts'
import { apiErrorResponse } from '@/lib/server/api-error'
import {
  AuthContextError,
  authContextErrorResponse,
  getCurrentAuthContext,
  hasPermission,
  type AppAuthContext,
} from '@/lib/server/auth-context'
import { prisma } from '@/lib/server/prisma'
import type { Prisma } from '../../../../../generated/prisma/client'

export const runtime = 'nodejs'

const noStoreHeaders = { 'Cache-Control': 'private, no-store' }
const scopeKeyQuerySchema = weightTicketFormDraftScopeSchema

type SavedDraftRow = {
  payload: Prisma.JsonValue
  revision: number
  scope_key: string
  updated_at: Date
}

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders, status })
}

function withNoStore(response: Response) {
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

function requireDraftPermission(context: AppAuthContext) {
  const canWriteWeightTicket = hasPermission(context, 'daily.weight_tickets.create')
    || hasPermission(context, 'daily.weight_tickets.update')
  if (!hasPermission(context, 'daily.weight_tickets.view') || !canWriteWeightTicket) {
    throw new AuthContextError('ไม่มีสิทธิ์บันทึกแบบร่างใบรับ-ส่งของ', 403)
  }
  if (!context.appUser) {
    throw new AuthContextError('ไม่พบข้อมูลผู้ใช้งานในระบบ', 403)
  }
  return context.appUser.id
}

function scopeKeyFromRequest(request: Request) {
  return scopeKeyQuerySchema.parse({
    scopeKey: new URL(request.url).searchParams.get('scopeKey') ?? '',
  }).scopeKey
}

function deleteValuesFromRequest(request: Request) {
  const searchParams = new URL(request.url).searchParams
  return weightTicketFormDraftDeleteSchema.parse({
    revision: searchParams.get('revision') ?? '',
    scopeKey: searchParams.get('scopeKey') ?? '',
  })
}

function draftResponse(row: SavedDraftRow) {
  return {
    payload: weightTicketFormDraftPayloadSchema.parse(row.payload),
    revision: row.revision,
    savedAt: row.updated_at.toISOString(),
    scopeKey: row.scope_key,
  }
}

function conflictResponse() {
  return privateJson({
    code: 'CONFLICT',
    error: 'แบบร่างนี้ถูกแก้ไขจากหน้าต่างอื่นแล้ว กรุณาโหลดข้อมูลล่าสุด',
  }, 409)
}

function isUniqueConstraintError(caught: unknown) {
  return typeof caught === 'object'
    && caught !== null
    && 'code' in caught
    && (caught as { code?: unknown }).code === 'P2002'
}

export async function GET(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    const appUserId = requireDraftPermission(context)
    const scopeKey = scopeKeyFromRequest(request)
    const draft = await prisma.weight_ticket_form_drafts.findFirst({
      select: {
        payload: true,
        revision: true,
        scope_key: true,
        updated_at: true,
      },
      where: {
        app_user_id: appUserId,
        scope_key: scopeKey,
      },
    })

    return privateJson({ draft: draft ? draftResponse(draft) : null })
  } catch (caught) {
    if (caught instanceof AuthContextError) return withNoStore(authContextErrorResponse(caught))
    return withNoStore(apiErrorResponse(caught, 'โหลดแบบร่างใบรับ-ส่งของไม่สำเร็จ', 400))
  }
}

export async function PUT(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    const appUserId = requireDraftPermission(context)
    const values = weightTicketFormDraftWriteSchema.parse(await request.json())
    const existing = await prisma.weight_ticket_form_drafts.findFirst({
      select: {
        id: true,
        revision: true,
      },
      where: {
        app_user_id: appUserId,
        scope_key: values.scopeKey,
      },
    })

    const now = new Date()
    if (!existing) {
      if (values.revision !== 0) return conflictResponse()
      try {
        const created = await prisma.weight_ticket_form_drafts.create({
          data: {
            app_user_id: appUserId,
            payload: values.payload as Prisma.InputJsonValue,
            revision: 1,
            scope_key: values.scopeKey,
            ticket_type: values.payload.type,
            updated_at: now,
          },
          select: {
            payload: true,
            revision: true,
            scope_key: true,
            updated_at: true,
          },
        })
        return privateJson(draftResponse(created))
      } catch (caught) {
        if (isUniqueConstraintError(caught)) return conflictResponse()
        throw caught
      }
    }

    if (existing.revision !== values.revision) return conflictResponse()
    const updated = await prisma.weight_ticket_form_drafts.updateMany({
      data: {
        payload: values.payload as Prisma.InputJsonValue,
        revision: existing.revision + 1,
        ticket_type: values.payload.type,
        updated_at: now,
      },
      where: {
        app_user_id: appUserId,
        id: existing.id,
        revision: values.revision,
        scope_key: values.scopeKey,
      },
    })
    if (updated.count !== 1) return conflictResponse()

    return privateJson({
      payload: values.payload,
      revision: existing.revision + 1,
      savedAt: now.toISOString(),
      scopeKey: values.scopeKey,
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return withNoStore(authContextErrorResponse(caught))
    return withNoStore(apiErrorResponse(caught, 'บันทึกแบบร่างใบรับ-ส่งของไม่สำเร็จ', 400))
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    const appUserId = requireDraftPermission(context)
    const values = deleteValuesFromRequest(request)
    const deleted = await prisma.weight_ticket_form_drafts.deleteMany({
      where: {
        app_user_id: appUserId,
        revision: values.revision,
        scope_key: values.scopeKey,
      },
    })

    if (deleted.count === 0) {
      const current = await prisma.weight_ticket_form_drafts.findFirst({
        select: { revision: true },
        where: {
          app_user_id: appUserId,
          scope_key: values.scopeKey,
        },
      })
      if (current) return conflictResponse()
    }

    return new Response(null, { headers: noStoreHeaders, status: 204 })
  } catch (caught) {
    if (caught instanceof AuthContextError) return withNoStore(authContextErrorResponse(caught))
    return withNoStore(apiErrorResponse(caught, 'ลบแบบร่างใบรับ-ส่งของไม่สำเร็จ', 400))
  }
}
