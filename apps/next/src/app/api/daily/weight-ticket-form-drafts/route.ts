import { NextResponse } from 'next/server'
import {
  weightTicketFormDraftDeleteSchema,
  weightTicketFormDraftPayloadSchema,
  weightTicketFormDraftScopeSchema,
  weightTicketFormDraftWriteSchema,
  withWeightTicketWorkingDraftLastChange,
  type WeightTicketFormDraftPayload,
} from '@/lib/weight-ticket-drafts'
import { apiErrorResponse } from '@/lib/server/api-error'
import {
  AuthContextError,
  authContextErrorResponse,
  getCurrentAuthContext,
  hasPermission,
  type AppAuthContext,
} from '@/lib/server/auth-context'
import { findActiveBranchReferenceByCodeOrId } from '@/lib/server/branch-reference'
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

type DraftScope =
  | { kind: 'new'; scopeKey: 'new:WTI' | 'new:WTO'; type: 'WTI' | 'WTO' }
  | { documentNo: string; kind: 'ticket'; scopeKey: string }

type DraftWritePreparation = {
  payload: WeightTicketFormDraftPayload
  visibilityBranchId: bigint | null
}

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders, status })
}

function withNoStore(response: Response) {
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

function requireDraftBasePermission(context: AppAuthContext) {
  if (!hasPermission(context, 'daily.weight_tickets.view')) {
    throw new AuthContextError('ไม่มีสิทธิ์บันทึกแบบร่างใบรับ-ส่งของ', 403)
  }
  if (!context.appUser) {
    throw new AuthContextError('ไม่พบข้อมูลผู้ใช้งานในระบบ', 403)
  }
  return context.appUser.id
}

function requireDraftScopePermission(context: AppAuthContext, scope: DraftScope) {
  const requiredPermission = scope.kind === 'new'
    ? 'daily.weight_tickets.create'
    : 'daily.weight_tickets.update'
  if (!hasPermission(context, requiredPermission)) {
    throw new AuthContextError('ไม่มีสิทธิ์บันทึกแบบร่างใบรับ-ส่งของ', 403)
  }
}

function parseDraftScope(scopeKey: string): DraftScope {
  if (scopeKey === 'new:WTI') return { kind: 'new', scopeKey, type: 'WTI' }
  if (scopeKey === 'new:WTO') return { kind: 'new', scopeKey, type: 'WTO' }

  const match = /^ticket:([A-Za-z0-9_-]{1,80})$/.exec(scopeKey)
  if (match) return { documentNo: match[1], kind: 'ticket', scopeKey }

  throw new AuthContextError('รหัสแบบร่างไม่ถูกต้อง', 400)
}

async function assertDraftBranchScope(context: AppAuthContext, branchId: string) {
  const requestedBranchId = branchId.trim()
  if (!requestedBranchId) return null

  const branch = await findActiveBranchReferenceByCodeOrId(requestedBranchId)
  if (!branch) {
    throw new AuthContextError('สาขาในแบบร่างไม่ถูกต้องหรือถูกปิดใช้งาน', 400)
  }

  const allowedBranchCodes = context.appUser?.branchIds ?? []
  if (
    !context.isAdmin
    && allowedBranchCodes.length > 0
    && !allowedBranchCodes.some((code) => code.trim().toUpperCase() === branch.code.trim().toUpperCase())
  ) {
    throw new AuthContextError('ไม่มีสิทธิ์บันทึกแบบร่างของสาขานี้', 403)
  }

  return branch
}

async function findScopedTicketForDraft(context: AppAuthContext, documentNo: string) {
  const scopedBranchIds = context.appUser?.branchIds ?? []
  const ticket = await prisma.weight_tickets.findFirst({
    select: {
      branch_id: true,
      doc_type: true,
    },
    where: {
      doc_no: documentNo,
      // Match the existing WTI/WTO list scope: admins are not narrowed by an
      // incidental branch mapping, while non-admin users remain branch-scoped.
      ...(!context.isAdmin && scopedBranchIds.length ? { branches: { code: { in: scopedBranchIds } } } : {}),
    },
  })
  if (!ticket) {
    throw new AuthContextError('ไม่พบใบรับ-ส่งของที่ต้องการ', 404)
  }
  return ticket
}

async function prepareDraftWrite(
  context: AppAuthContext,
  scope: DraftScope,
  payload: WeightTicketFormDraftPayload,
): Promise<DraftWritePreparation> {
  if (scope.kind === 'new') {
    if (payload.type !== scope.type) {
      throw new AuthContextError('ประเภทใบรับ-ส่งของไม่ตรงกับแบบร่าง', 400)
    }
    const branch = await assertDraftBranchScope(context, payload.branchId)
    return {
      payload: branch
        ? { ...payload, branchId: String(branch.id), branchName: branch.name }
        : payload,
      visibilityBranchId: branch?.id ?? null,
    }
  }

  const ticket = await findScopedTicketForDraft(context, scope.documentNo)
  if (ticket.doc_type !== payload.type) {
    throw new AuthContextError('ประเภทใบรับ-ส่งของไม่ตรงกับเอกสาร', 400)
  }
  await assertDraftBranchScope(context, payload.branchId)
  return { payload, visibilityBranchId: ticket.branch_id }
}

function scopeKeyFromRequest(request: Request) {
  const { scopeKey } = scopeKeyQuerySchema.parse({
    scopeKey: new URL(request.url).searchParams.get('scopeKey') ?? '',
  })
  return parseDraftScope(scopeKey)
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
    const scope = scopeKeyFromRequest(request)
    const appUserId = requireDraftBasePermission(context)
    requireDraftScopePermission(context, scope)
    if (scope.kind === 'ticket') await findScopedTicketForDraft(context, scope.documentNo)
    const draft = await prisma.weight_ticket_form_drafts.findFirst({
      select: {
        payload: true,
        revision: true,
        scope_key: true,
        updated_at: true,
      },
      where: {
        app_user_id: appUserId,
        scope_key: scope.scopeKey,
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
    const appUserId = requireDraftBasePermission(context)
    const values = weightTicketFormDraftWriteSchema.parse(await request.json())
    const scope = parseDraftScope(values.scopeKey)
    requireDraftScopePermission(context, scope)
    const prepared = await prepareDraftWrite(context, scope, values.payload)
    const existing = await prisma.weight_ticket_form_drafts.findFirst({
      select: {
        id: true,
        payload: true,
        revision: true,
      },
      where: {
        app_user_id: appUserId,
        scope_key: scope.scopeKey,
      },
    })

    const now = new Date()
    if (!existing) {
      if (values.revision !== 0) return conflictResponse()
      const payload = withWeightTicketWorkingDraftLastChange(null, prepared.payload)
      try {
        const created = await prisma.weight_ticket_form_drafts.create({
          data: {
            app_user_id: appUserId,
            payload: payload as Prisma.InputJsonValue,
            revision: 1,
            scope_key: scope.scopeKey,
            ticket_type: payload.type,
            updated_at: now,
            visibility_branch_id: prepared.visibilityBranchId,
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
    const payload = withWeightTicketWorkingDraftLastChange(
      weightTicketFormDraftPayloadSchema.parse(existing.payload),
      prepared.payload,
    )
    const updated = await prisma.weight_ticket_form_drafts.updateMany({
      data: {
        payload: payload as Prisma.InputJsonValue,
        revision: existing.revision + 1,
        ticket_type: payload.type,
        updated_at: now,
        visibility_branch_id: prepared.visibilityBranchId,
      },
      where: {
        app_user_id: appUserId,
        id: existing.id,
        revision: values.revision,
        scope_key: scope.scopeKey,
      },
    })
    if (updated.count !== 1) return conflictResponse()

    return privateJson({
      payload,
      revision: existing.revision + 1,
      savedAt: now.toISOString(),
      scopeKey: scope.scopeKey,
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return withNoStore(authContextErrorResponse(caught))
    return withNoStore(apiErrorResponse(caught, 'บันทึกแบบร่างใบรับ-ส่งของไม่สำเร็จ', 400))
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    const values = deleteValuesFromRequest(request)
    const scope = parseDraftScope(values.scopeKey)
    const appUserId = requireDraftBasePermission(context)
    requireDraftScopePermission(context, scope)
    if (scope.kind === 'ticket') await findScopedTicketForDraft(context, scope.documentNo)
    const deleted = await prisma.weight_ticket_form_drafts.deleteMany({
      where: {
        app_user_id: appUserId,
        revision: values.revision,
        scope_key: scope.scopeKey,
      },
    })

    if (deleted.count === 0) {
      const current = await prisma.weight_ticket_form_drafts.findFirst({
        select: { revision: true },
        where: {
          app_user_id: appUserId,
          scope_key: scope.scopeKey,
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
