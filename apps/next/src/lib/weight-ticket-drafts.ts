import { z } from 'zod'

import { readJsonResponse } from './api-client'

export const WEIGHT_TICKET_WORKING_DRAFT_HEADER = 'x-ns-weight-ticket-working-draft'

const draftScopeKeySchema = z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9:_-]+$/, 'รหัสแบบร่างไม่ถูกต้อง')
const draftDecimalSchema = z.string().max(14).regex(/^\d{0,10}(?:\.\d{0,3})?$/, 'รูปแบบตัวเลขไม่ถูกต้อง').default('')
const draftText = (maxLength: number) => z.string().max(maxLength).default('')
const draftIdentifierSchema = z.string().trim().max(80).default('')
export const weightTicketWorkingDraftActivitySchema = z.enum([
  'document',
  'party',
  'vehicle',
  'product',
  'line',
  'lot',
  'weight',
  'deduction',
  'attachment',
  'remark',
])
export type WeightTicketWorkingDraftActivity = z.output<typeof weightTicketWorkingDraftActivitySchema>
// This is deliberately an allowlist. The team feed can say what changed
// without exposing typed remarks, attachment URLs, or internal IDs.
export const weightTicketWorkingDraftActivityDetailSchema = z.enum([
  'document',
  'branch',
  'godown',
  'party',
  'vehicle',
  'product',
  'warehouse',
  'line-added',
  'line-removed',
  'line-changed',
  'lot-added',
  'lot-removed',
  'weight',
  'deduction',
  'impurity-added',
  'impurity-removed',
  'impurity-purchase',
  'attachment',
  'remark',
])
export type WeightTicketWorkingDraftActivityDetail = z.output<typeof weightTicketWorkingDraftActivityDetailSchema>
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
  activity: weightTicketWorkingDraftActivitySchema.default('document'),
  activityDetail: weightTicketWorkingDraftActivityDetailSchema.default('document'),
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
  lastChange: z.object({
    grossWeightKg: z.number().finite().nonnegative().optional(),
    kind: weightTicketWorkingDraftActivityDetailSchema,
    productId: z.string().trim().min(1).max(80).optional(),
    productName: z.string().trim().min(1).max(240).optional(),
    warehouseId: z.string().trim().min(1).max(80).optional(),
    warehouseName: z.string().trim().min(1).max(160).optional(),
  }).strict().default({ kind: 'document' }),
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
export type WeightTicketWorkingDraftLastChange = WeightTicketFormDraftPayload['lastChange']

function formatWorkingDraftActivityWeight(value: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return ''
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 3 }).format(amount)
}

type DraftLine = WeightTicketFormDraftPayload['lines'][number]

function activityForLastChange(kind: WeightTicketWorkingDraftLastChange['kind']): WeightTicketWorkingDraftActivity {
  if (kind === 'party') return 'party'
  if (kind === 'vehicle') return 'vehicle'
  if (kind === 'product') return 'product'
  if (kind === 'lot-added' || kind === 'lot-removed') return 'lot'
  if (kind === 'weight') return 'weight'
  if (kind === 'deduction') return 'deduction'
  if (kind === 'attachment') return 'attachment'
  if (kind === 'remark') return 'remark'
  if (kind === 'line-added' || kind === 'line-removed' || kind === 'line-changed' || kind.startsWith('impurity-')) return 'line'
  return 'document'
}

function equalValues(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function lineContext(line: DraftLine | undefined, lines: DraftLine[]) {
  const parent = line?.parentId ? lines.find((entry) => entry.id === line.parentId) : undefined
  const productName = line?.productName.trim() || parent?.productName.trim() || undefined
  const warehouseName = line?.warehouseName.trim() || parent?.warehouseName.trim() || undefined
  return { productName, warehouseName }
}

function changeForLine(
  kind: WeightTicketWorkingDraftLastChange['kind'],
  line: DraftLine | undefined,
  lines: DraftLine[],
): WeightTicketWorkingDraftLastChange {
  const context = lineContext(line, lines)
  return {
    kind,
    ...(line?.productId.trim() ? { productId: line.productId.trim() } : {}),
    ...(context.productName ? { productName: context.productName } : {}),
    ...(kind === 'warehouse' && line?.warehouseId.trim() ? { warehouseId: line.warehouseId.trim() } : {}),
    ...(kind === 'warehouse' && context.warehouseName ? { warehouseName: context.warehouseName } : {}),
    ...(kind === 'weight' && line?.grossWeight ? { grossWeightKg: Number(line.grossWeight) } : {}),
  }
}

function emptyPayloadForChange(payload: WeightTicketFormDraftPayload): WeightTicketFormDraftPayload {
  return {
    ...payload,
    activity: 'document',
    activityDetail: 'document',
    branchId: '',
    branchName: '',
    godownName: '',
    lastChange: { kind: 'document' },
    lines: payload.lines.map((line) => ({
      ...line,
      containerDeductionWeight: '',
      deductionMode: 'none',
      deductionValue: '',
      grossWeight: '',
      imageNames: [],
      impurityId: '',
      impurityName: '',
      impurityProductId: '',
      impurityProductName: '',
      impurityPurchaseAction: 'none',
      note: '',
      productId: '',
      productName: '',
      warehouseId: '',
      warehouseName: '',
      warehouseType: '',
    })),
    partyId: '',
    partyName: '',
    remark: '',
    vehicleImageNames: [],
    vehicleNo: '',
  }
}

export function deriveWeightTicketWorkingDraftLastChange(
  previous: WeightTicketFormDraftPayload | null,
  next: WeightTicketFormDraftPayload,
): WeightTicketWorkingDraftLastChange {
  const before = previous ?? emptyPayloadForChange(next)

  if (before.branchId !== next.branchId || before.branchName !== next.branchName) {
    return { kind: 'branch' }
  }
  if (before.partyId !== next.partyId || before.partyName !== next.partyName) return { kind: 'party' }
  if (before.vehicleNo !== next.vehicleNo) return { kind: 'vehicle' }
  if (!equalValues(before.vehicleImageNames, next.vehicleImageNames)) return { kind: 'attachment' }
  if (before.remark !== next.remark) return { kind: 'remark' }
  if (before.godownName !== next.godownName) return { kind: 'godown' }

  const beforeById = new Map(before.lines.map((line) => [line.id, line]))
  for (const nextLine of next.lines) {
    const beforeLine = beforeById.get(nextLine.id)
    if (!beforeLine) continue
    if (beforeLine.productId !== nextLine.productId || beforeLine.productName !== nextLine.productName) return changeForLine('product', nextLine, next.lines)
    if (beforeLine.warehouseId !== nextLine.warehouseId || beforeLine.warehouseName !== nextLine.warehouseName) return changeForLine('warehouse', nextLine, next.lines)
    if (beforeLine.grossWeight !== nextLine.grossWeight) return changeForLine('weight', nextLine, next.lines)
    if (
      beforeLine.containerDeductionWeight !== nextLine.containerDeductionWeight
      || beforeLine.deductionMode !== nextLine.deductionMode
      || beforeLine.deductionValue !== nextLine.deductionValue
    ) return changeForLine('deduction', nextLine, next.lines)
    if (
      beforeLine.impurityId !== nextLine.impurityId
      || beforeLine.impurityName !== nextLine.impurityName
      || beforeLine.impurityProductId !== nextLine.impurityProductId
      || beforeLine.impurityProductName !== nextLine.impurityProductName
      || beforeLine.impurityPurchaseAction !== nextLine.impurityPurchaseAction
    ) return changeForLine(beforeLine.impurityPurchaseAction !== nextLine.impurityPurchaseAction ? 'impurity-purchase' : 'line-changed', nextLine, next.lines)
    if (!equalValues(beforeLine.imageNames, nextLine.imageNames)) return changeForLine('attachment', nextLine, next.lines)
    if (beforeLine.note !== nextLine.note) return changeForLine('remark', nextLine, next.lines)
  }

  const added = next.lines.find((line) => !beforeById.has(line.id))
  if (added) return changeForLine(added.impurityId ? 'impurity-added' : added.parentId ? 'lot-added' : 'line-added', added, next.lines)

  const nextIds = new Set(next.lines.map((line) => line.id))
  const removed = before.lines.find((line) => !nextIds.has(line.id))
  if (removed) return changeForLine(removed.impurityId ? 'impurity-removed' : removed.parentId ? 'lot-removed' : 'line-removed', removed, before.lines)

  return { kind: 'document' }
}

export function withWeightTicketWorkingDraftLastChange(
  previous: WeightTicketFormDraftPayload | null,
  next: WeightTicketFormDraftPayload,
): WeightTicketFormDraftPayload {
  const lastChange = deriveWeightTicketWorkingDraftLastChange(previous, next)
  return {
    ...next,
    activity: activityForLastChange(lastChange.kind),
    activityDetail: lastChange.kind,
    lastChange,
  }
}

// The team feed receives only this server-derived sentence. It never includes
// typed remarks, image references, ids, or manually typed locations.
export function describeWeightTicketWorkingDraftLastChange(change: WeightTicketWorkingDraftLastChange) {
  const product = change.productName ? ` — ${change.productName}` : ''
  const warehouse = change.warehouseName ? ` → ${change.warehouseName}` : ''
  const description = (() => {
    switch (change.kind) {
      case 'attachment': return 'แนบหรือแก้ไขรูปภาพ'
      case 'branch': return 'เปลี่ยนสาขา'
      case 'deduction': return `แก้ไขการหักน้ำหนัก${product}`
      case 'document': return 'แก้ไขข้อมูลเอกสาร'
      case 'godown': return 'แก้ไขพื้นที่รับ-ส่ง'
      case 'impurity-added': return `เพิ่มรายการสิ่งเจือปน${product}`
      case 'impurity-purchase': return `ตั้งค่าซื้อสินค้าจากสิ่งเจือปน${product}`
      case 'impurity-removed': return `ลบรายการสิ่งเจือปน${product}`
      case 'line-added': return `เพิ่มรายการสินค้า${product}`
      case 'line-changed': return `แก้ไขรายละเอียดสินค้า${product}`
      case 'line-removed': return `ลบรายการสินค้า${product}`
      case 'lot-added': return `เพิ่มเต๋าชั่ง${product}`
      case 'lot-removed': return `ลบเต๋าชั่ง${product}`
      case 'party': return 'เปลี่ยนคู่ค้า'
      case 'product': return `เลือกสินค้า${product}`
      case 'remark': return 'แก้ไขหมายเหตุ'
      case 'vehicle': return 'แก้ไขทะเบียนรถ'
      case 'warehouse': return `เปลี่ยนคลัง${product}${warehouse}`
      case 'weight': return `แก้น้ำหนักชั่ง${product}${change.grossWeightKg !== undefined ? ` · ${formatWorkingDraftActivityWeight(String(change.grossWeightKg))} กก.` : ''}`
    }

    return 'แก้ไขแบบร่าง'
  })()
  return description.length <= 240 ? description : `${description.slice(0, 239)}…`
}

export function hasWeightTicketWorkingDraftContent(payload: WeightTicketFormDraftPayload) {
  return Boolean(
    payload.branchId
    || payload.partyId
    || payload.remark.trim()
    || payload.vehicleNo.trim()
    || payload.vehicleImageNames.length
    || payload.godownName.trim()
    || payload.lines.some((line) => (
      line.productId
      || line.grossWeight
      || line.containerDeductionWeight
      || line.deductionValue
      || line.note.trim()
      || line.imageNames.length
    )),
  )
}

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

const weightTicketTeamDraftSchema = z.object({
  activity: weightTicketWorkingDraftActivitySchema,
  activityDetail: weightTicketWorkingDraftActivityDetailSchema,
  activityDescription: z.string().trim().min(1).max(240),
  branchId: z.string().trim().min(1).max(80),
  branchName: z.string().trim().min(1).max(160),
  drafterName: z.string().trim().min(1).max(160),
  documentNo: z.string().trim().max(80),
  grossWeight: z.number().finite().nonnegative(),
  lineCount: z.number().int().nonnegative(),
  netWeight: z.number().finite().nonnegative(),
  otherProductCount: z.number().int().nonnegative(),
  partyName: z.string().max(240),
  productNames: z.array(z.string().trim().min(1).max(240)).max(3),
  savedAt: z.string().min(1),
  type: z.enum(['WTI', 'WTO']),
})

const weightTicketTeamDraftReadResponseSchema = z.object({
  drafts: z.array(weightTicketTeamDraftSchema),
  truncated: z.boolean(),
})

export type WeightTicketTeamDraft = z.output<typeof weightTicketTeamDraftSchema>
export type WeightTicketTeamDraftsResponse = z.output<typeof weightTicketTeamDraftReadResponseSchema>

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

export async function getWeightTicketTeamDrafts(options?: { signal?: AbortSignal }) {
  const response = await fetch('/api/daily/weight-ticket-form-drafts/team', {
    cache: 'no-store',
    signal: options?.signal,
  })
  const result = await readJsonResponse(
    response,
    weightTicketTeamDraftReadResponseSchema,
    'โหลดรายการที่กำลังกรอกไม่สำเร็จ',
  )
  return result
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

export class WeightTicketDraftDebounce {
  private timeoutId: ReturnType<typeof setTimeout> | null = null

  cancel() {
    if (this.timeoutId === null) return
    clearTimeout(this.timeoutId)
    this.timeoutId = null
  }

  schedule(callback: () => void, delayMs: number) {
    this.cancel()
    this.timeoutId = setTimeout(() => {
      this.timeoutId = null
      callback()
    }, delayMs)
  }
}
