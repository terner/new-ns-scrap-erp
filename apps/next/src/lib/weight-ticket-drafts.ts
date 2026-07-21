import { z } from 'zod'

import { readJsonResponse } from './api-client'

export const WEIGHT_TICKET_WORKING_DRAFT_HEADER = 'x-ns-weight-ticket-working-draft'

const draftScopeKeySchema = z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9:_-]+$/, 'รหัสแบบร่างไม่ถูกต้อง')
const draftDecimalSchema = z.string().max(14).regex(/^\d{0,10}(?:\.\d{0,3})?$/, 'รูปแบบตัวเลขไม่ถูกต้อง').default('')
const draftText = (maxLength: number) => z.string().max(maxLength).default('')
const draftIdentifierSchema = z.string().trim().max(80).default('')
const storedAttachmentReferenceSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  storageKey: z.string().trim().min(1).max(1_024).refine((value) => !value.startsWith('data:'), 'ข้อมูลอ้างอิงรูปไม่ถูกต้อง'),
  url: z.string().url().max(2_048).refine((value) => /^https?:\/\//.test(value), 'ข้อมูลอ้างอิงรูปไม่ถูกต้อง'),
}).strict()
export function isWeightTicketDraftAttachmentReference(value: string) {
  try {
    return storedAttachmentReferenceSchema.safeParse(JSON.parse(value)).success
  } catch {
    return false
  }
}
const draftAttachmentSchema = z.string().trim().min(1).max(4_096).refine(isWeightTicketDraftAttachmentReference, 'แบบร่างรองรับเฉพาะข้อมูลอ้างอิงรูปที่อัปโหลดแล้ว')

const weightTicketFormDraftLineSchema = z.object({
  containerDeductionWeight: draftDecimalSchema,
  deductionMode: z.enum(['none', 'kg', 'percent']).default('none'),
  deductionValue: draftDecimalSchema,
  grossWeight: draftDecimalSchema,
  id: z.string().trim().min(1).max(80),
  imageNames: z.array(draftAttachmentSchema).default([]),
  impurityId: draftIdentifierSchema,
  impurityName: draftText(160),
  impurityProductId: draftIdentifierSchema,
  impurityProductName: draftText(160),
  impurityPurchaseAction: z.enum(['none', 'buy']).default('none'),
  impuritySourceLineId: z.string().trim().max(80).optional(),
  note: draftText(160),
  parentId: z.string().trim().max(80).optional(),
  productId: draftIdentifierSchema,
  productName: draftText(240),
  warehouseId: draftIdentifierSchema,
  warehouseName: draftText(160),
  warehouseType: draftText(80),
})

export const weightTicketFormDraftPayloadSchema = z.object({
  branchId: draftIdentifierSchema,
  branchName: draftText(160),
  godownName: draftText(100),
  lines: z.array(weightTicketFormDraftLineSchema).min(1),
  partyId: draftIdentifierSchema,
  partyName: draftText(240),
  remark: draftText(500),
  type: z.enum(['WTI', 'WTO']),
  vehicleImageNames: z.array(draftAttachmentSchema).default([]),
  vehicleNo: draftText(24),
}).superRefine((value, ctx) => {
  const linesById = new Map<string, (typeof value.lines)[number]>()
  value.lines.forEach((line, index) => {
    if (linesById.has(line.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'รหัสรายการในแบบร่างซ้ำกัน',
        path: ['lines', index, 'id'],
      })
      return
    }
    linesById.set(line.id, line)
  })

  value.lines.forEach((line, index) => {
    const parentId = line.parentId?.trim()
    if (parentId) {
      if (parentId === line.id || !linesById.has(parentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'ไม่พบรายการหลักที่อ้างอิงในแบบร่าง',
          path: ['lines', index, 'parentId'],
        })
      }
    }
    const impuritySourceLineId = line.impuritySourceLineId?.trim()
    if (impuritySourceLineId && !linesById.has(impuritySourceLineId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ไม่พบรายการสิ่งเจือปนที่อ้างอิงในแบบร่าง',
        path: ['lines', index, 'impuritySourceLineId'],
      })
    }
  })

  const visited = new Set<string>()
  const visiting = new Set<string>()
  const visit = (lineId: string): boolean => {
    if (visited.has(lineId) || visiting.has(lineId)) return visiting.has(lineId)
    visiting.add(lineId)
    const parentId = linesById.get(lineId)?.parentId?.trim()
    const hasCycle = Boolean(parentId && linesById.has(parentId) && visit(parentId))
    visiting.delete(lineId)
    visited.add(lineId)
    return hasCycle
  }
  value.lines.forEach((line, index) => {
    if (visit(line.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'รายการหลักและรายการย่อยอ้างอิงกันเป็นวงจร',
        path: ['lines', index, 'parentId'],
      })
    }
  })

  if (JSON.stringify(value).length > 1_000_000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'แบบร่างมีขนาดใหญ่เกินไป',
      path: [],
    })
  }
})

export type WeightTicketFormDraftPayload = z.output<typeof weightTicketFormDraftPayloadSchema>

export const weightTicketFormDraftScopeSchema = z.object({
  scopeKey: draftScopeKeySchema,
})

export const weightTicketFormDraftDeleteSchema = weightTicketFormDraftScopeSchema.extend({
  revision: z.coerce.number().int().nonnegative(),
})

export type WeightTicketWorkingDraftCleanup = z.output<typeof weightTicketFormDraftDeleteSchema>

export const weightTicketFormDraftWriteSchema = weightTicketFormDraftScopeSchema.extend({
  payload: weightTicketFormDraftPayloadSchema,
  revision: z.number().int().nonnegative(),
}).superRefine((value, ctx) => {
  const typeForNewDraft = /^new:(WTI|WTO)$/.exec(value.scopeKey)?.[1]
  if (typeForNewDraft && typeForNewDraft !== value.payload.type) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'ประเภทใบรับ-ส่งของไม่ตรงกับแบบร่าง',
      path: ['payload', 'type'],
    })
  }
})

const weightTicketFormDraftRecordSchema = z.object({
  payload: weightTicketFormDraftPayloadSchema,
  revision: z.number().int().positive(),
  savedAt: z.string(),
  scopeKey: draftScopeKeySchema,
})

const weightTicketFormDraftReadResponseSchema = z.object({
  draft: weightTicketFormDraftRecordSchema.nullable(),
})

export type WeightTicketFormDraftRecord = z.output<typeof weightTicketFormDraftRecordSchema>

export function isWeightTicketWorkingDraftNewerThanDocument(
  draftSavedAt: string,
  documentUpdatedAt: string | null | undefined,
  documentCreatedAt: string | null | undefined,
) {
  const draftSavedAtMs = Date.parse(draftSavedAt)
  const documentUpdatedAtMs = Date.parse(documentUpdatedAt ?? '')
  const documentCreatedAtMs = Date.parse(documentCreatedAt ?? '')
  const documentSavedAtMs = Number.isFinite(documentUpdatedAtMs)
    ? documentUpdatedAtMs
    : documentCreatedAtMs

  return Number.isFinite(draftSavedAtMs)
    && Number.isFinite(documentSavedAtMs)
    && draftSavedAtMs > documentSavedAtMs
}

export async function getWeightTicketFormDraft(scopeKey: string, options?: { signal?: AbortSignal }) {
  const parsedScopeKey = draftScopeKeySchema.parse(scopeKey)
  const query = new URLSearchParams({ scopeKey: parsedScopeKey })
  const response = await fetch(`/api/daily/weight-ticket-form-drafts?${query.toString()}`, {
    cache: 'no-store',
    signal: options?.signal,
  })
  const result = await readJsonResponse(response, weightTicketFormDraftReadResponseSchema, 'โหลดแบบร่างใบรับ-ส่งของไม่สำเร็จ')
  return result.draft
}

export async function saveWeightTicketFormDraft(input: z.input<typeof weightTicketFormDraftWriteSchema>) {
  const values = weightTicketFormDraftWriteSchema.parse(input)
  const response = await fetch('/api/daily/weight-ticket-form-drafts', {
    body: JSON.stringify(values),
    headers: { 'Content-Type': 'application/json' },
    method: 'PUT',
  })
  return readJsonResponse(response, weightTicketFormDraftRecordSchema, 'บันทึกแบบร่างใบรับ-ส่งของไม่สำเร็จ')
}

export async function deleteWeightTicketFormDraft(scopeKey: string, revision: number) {
  const values = weightTicketFormDraftDeleteSchema.parse({ revision, scopeKey })
  const query = new URLSearchParams({
    revision: String(values.revision),
    scopeKey: values.scopeKey,
  })
  const response = await fetch(`/api/daily/weight-ticket-form-drafts?${query.toString()}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    await readJsonResponse(response, z.object({}), 'ลบแบบร่างใบรับ-ส่งของไม่สำเร็จ')
  }
}

export class WeightTicketDraftAutosaveQueue<TPayload> {
  private activeSave: Promise<WeightTicketFormDraftRecord | null> | null = null
  private pendingPayload: TPayload | null = null

  revision = 0

  constructor(private readonly persist: (payload: TPayload, revision: number) => Promise<WeightTicketFormDraftRecord>) {}

  enqueue(payload: TPayload) {
    this.pendingPayload = payload
    if (!this.activeSave) this.activeSave = this.drain()
    return this.activeSave
  }

  flush() {
    if (!this.activeSave && this.pendingPayload) this.activeSave = this.drain()
    return this.activeSave ?? Promise.resolve(null)
  }

  reset(revision = 0) {
    this.pendingPayload = null
    this.revision = revision
  }

  setRevision(revision: number) {
    this.revision = Math.max(0, revision)
  }

  private async drain() {
    let lastSaved: WeightTicketFormDraftRecord | null = null
    try {
      while (this.pendingPayload) {
        const payload = this.pendingPayload
        this.pendingPayload = null
        lastSaved = await this.persist(payload, this.revision)
        this.revision = lastSaved.revision
      }
      return lastSaved
    } finally {
      this.activeSave = null
    }
  }
}
