import { randomUUID } from 'node:crypto'
import type { Prisma } from '../../../generated/prisma/client'
import { calculateLineTotals, type WeightTicketFormValues, type WeightTicketStatus, type WeightTicketType } from '@/lib/weight-tickets'
import type { AppAuthContext } from '@/lib/server/auth-context'
import { normalizeDate, toDateOnly, toNumber } from '@/lib/server/daily'

export type WeightTicketQuery = {
  branchId?: string
  dateFrom?: string
  dateTo?: string
  page: number
  pageSize: number
  search?: string
  sortBy: 'createdAt' | 'documentNo' | 'netWeight' | 'partyName'
  sortDir: 'asc' | 'desc'
  status?: string
  type?: string
}

type WeightTicketRow = Prisma.weight_ticketsGetPayload<{
  include: {
    branches: true
    customers: true
    suppliers: true
    weight_ticket_lines: {
      orderBy: {
        line_no: 'asc'
      }
    }
  }
}>

type WeightTicketTimelineRow = {
  action: string
  actor_display_name: string | null
  actor_username: string | null
  event_key: string
  id: string
  metadata: Prisma.JsonValue | null
  occurred_at: Date
  outcome: string
}

export function parseWeightTicketQuery(url: URL): WeightTicketQuery {
  const sortBy = url.searchParams.get('sortBy')
  const sortDir = url.searchParams.get('sortDir')
  return {
    branchId: url.searchParams.get('branchId') || undefined,
    dateFrom: url.searchParams.get('dateFrom') || undefined,
    dateTo: url.searchParams.get('dateTo') || undefined,
    page: Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1),
    pageSize: Math.min(100, Math.max(10, Number(url.searchParams.get('pageSize') ?? 10) || 10)),
    search: url.searchParams.get('search')?.trim() || undefined,
    sortBy: sortBy === 'documentNo' || sortBy === 'partyName' || sortBy === 'netWeight' ? sortBy : 'createdAt',
    sortDir: sortDir === 'asc' ? 'asc' : 'desc',
    status: url.searchParams.get('status') || undefined,
    type: url.searchParams.get('type') || undefined,
  }
}

export function weightTicketOrderBy(query: WeightTicketQuery): Prisma.weight_ticketsOrderByWithRelationInput[] {
  const direction = query.sortDir

  if (query.sortBy === 'documentNo') {
    return [{ doc_no: direction }, { created_at: 'desc' }]
  }
  if (query.sortBy === 'partyName') {
    return [{ party_name: direction }, { created_at: 'desc' }]
  }
  if (query.sortBy === 'netWeight') {
    return [{ net_weight: direction }, { created_at: 'desc' }]
  }

  return [{ created_at: direction }, { doc_no: 'desc' }]
}

export function bangkokDateInput(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
  }).formatToParts(value)
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

function documentPeriod(date: string) {
  return date.slice(2, 4) + date.slice(5, 7)
}

export function branchScopeIds(context: AppAuthContext) {
  return context.isAdmin ? [] : context.appUser?.branchIds ?? []
}

export function enteredByLabel(context: AppAuthContext) {
  return context.appUser?.displayName
    ?? context.appUser?.username
    ?? context.appUser?.email
    ?? context.authUser.email
    ?? 'ผู้ใช้ปัจจุบัน'
}

export function defaultTicketStatus(type: WeightTicketType): WeightTicketStatus {
  return type === 'WTI' ? 'received' : 'delivered'
}

export async function nextWeightTicketDocNo(
  tx: Prisma.TransactionClient,
  type: WeightTicketType,
  branchCode: string,
  documentDate: string,
) {
  const period = documentPeriod(documentDate)
  const startsWith = `${type}${branchCode}${period}-`
  const rows = await tx.$queryRaw<Array<{ doc_no: string }>>`
    select doc_no
    from public.weight_tickets
    where doc_no like ${`${startsWith}%`}
  `
  const lastNumber = rows.reduce((max: number, row: { doc_no: string }) => {
    const running = Number(row.doc_no.split('-').at(-1))
    return Number.isFinite(running) && running > max ? running : max
  }, 0)
  return `${startsWith}${String(lastNumber + 1).padStart(4, '0')}`
}

export function weightTicketWhere(query: WeightTicketQuery, scopedBranchIds: string[]): Prisma.weight_ticketsWhereInput {
  const andWhere: Prisma.weight_ticketsWhereInput[] = []
  if (scopedBranchIds.length) andWhere.push({ branch_id: { in: scopedBranchIds } })
  if (query.branchId) andWhere.push({ branch_id: query.branchId })

  const where: Prisma.weight_ticketsWhereInput = andWhere.length ? { AND: andWhere } : {}
  if (query.type) where.doc_type = query.type
  if (query.status) where.status = query.status
  if (query.dateFrom || query.dateTo) {
    where.document_date = {
      ...(query.dateFrom ? { gte: normalizeDate(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: normalizeDate(query.dateTo) } : {}),
    }
  }
  if (query.search) {
    where.OR = [
      { doc_no: { contains: query.search, mode: 'insensitive' } },
      { party_name: { contains: query.search, mode: 'insensitive' } },
      { vehicle_no: { contains: query.search, mode: 'insensitive' } },
      { weight_ticket_lines: { some: { product_name: { contains: query.search, mode: 'insensitive' } } } },
      { weight_ticket_lines: { some: { impurity_name: { contains: query.search, mode: 'insensitive' } } } },
    ]
  }

  return where
}

export function buildWeightTicketLineRows(
  ticketId: string,
  values: WeightTicketFormValues,
  productById: Map<string, { id: string; name: string }>,
  impurityById: Map<string, { id: string; name: string }>,
) {
  return values.lines.map((line, index) => {
    const lineTotals = calculateLineTotals({
      deductionMode: line.deductionMode,
      deductionValue: String(line.deductionValue),
      grossWeight: String(line.grossWeight),
    })
    const impurity = line.impurityId ? impurityById.get(line.impurityId) : null
    const product = productById.get(line.productId)

    return {
      deduct_weight: lineTotals.deductionWeight,
      deduction_mode: line.deductionMode,
      deduction_value: line.deductionMode === 'none' ? 0 : Number(line.deductionValue),
      gross_weight: lineTotals.grossWeight,
      id: line.id || `WTL-${randomUUID()}`,
      image_count: line.imageNames.length,
      image_names: line.imageNames,
      impurity_id: impurity?.id ?? null,
      impurity_name: impurity?.name ?? null,
      line_no: index + 1,
      net_weight: lineTotals.netWeight,
      note: line.note || null,
      product_id: line.productId,
      product_name: product?.name ?? line.productId,
      weight_ticket_id: ticketId,
    }
  })
}

export async function getWeightTicketUsageCounts(tx: Prisma.TransactionClient | PrismaClientLike, ticketId: string) {
  const purchaseRows = await tx.$queryRaw<Array<{ bill_count: number }>>`
    select count(distinct pb.id)::int as bill_count
    from public.purchase_bills pb
    join public.purchase_bill_items pbi on pbi.purchase_bill_id = pb.id
    where coalesce(pb.status, '') <> 'cancelled'
      and coalesce(pbi.source_snapshot ->> 'receiptTicketId', '') = ${ticketId}
  `

  return {
    purchaseCount: purchaseRows[0]?.bill_count ?? 0,
    salesCount: 0,
  }
}

export async function getWeightTicketTimeline(tx: Prisma.TransactionClient | PrismaClientLike, ticketId: string) {
  const rows = await tx.$queryRaw<WeightTicketTimelineRow[]>`
    select
      a.id::text as id,
      a.event_key,
      a.action,
      a.outcome,
      a.occurred_at,
      a.metadata,
      a.actor_display_name,
      a.actor_username
    from public.app_audit_logs a
    where a.entity_table = 'weight_tickets'
      and a.entity_id = ${ticketId}
    order by a.occurred_at desc, a.id desc
  `

  return rows.map((row) => ({
    action: row.action,
    actorName: row.actor_display_name ?? row.actor_username ?? '-',
    eventKey: row.event_key,
    id: row.id,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {},
    occurredAt: row.occurred_at.toISOString(),
    outcome: (row.outcome === 'blocked' || row.outcome === 'failure' ? row.outcome : 'success') as 'blocked' | 'failure' | 'success',
  }))
}

type PrismaClientLike = {
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]): Promise<T>
}

export function canMutateWeightTicket(row: { status: string | null }, usage: { purchaseCount: number; salesCount: number }) {
  return row.status !== 'cancelled' && usage.purchaseCount === 0 && usage.salesCount === 0
}

export function mapWeightTicketRow(row: WeightTicketRow, usage: { purchaseCount: number; salesCount: number }) {
  const canMutate = canMutateWeightTicket(row, usage)
  const lineRows = row.weight_ticket_lines.map((line: WeightTicketRow['weight_ticket_lines'][number]) => ({
    deductionMode: (line.deduction_mode ?? 'none') as 'none' | 'kg' | 'percent',
    deductionValue: toNumber(line.deduction_value).toString(),
    deductionWeight: toNumber(line.deduct_weight),
    grossWeight: toNumber(line.gross_weight).toString(),
    grossWeightValue: toNumber(line.gross_weight),
    id: line.id,
    imageCount: line.image_count ?? 0,
    imageNames: line.image_names ?? [],
    impurityId: line.impurity_id ?? '',
    impurityName: line.impurity_name ?? '',
    netWeight: toNumber(line.net_weight),
    note: line.note ?? '',
    productId: line.product_id,
    productName: line.product_name,
  }))
  const lineImageNames = lineRows.flatMap((line: { imageNames: string[] }) => line.imageNames)

  return {
    branchId: row.branch_id,
    branchName: row.branches?.name ?? row.branch_id,
    canCancel: canMutate,
    canEdit: canMutate,
    cancelNote: row.cancel_note ?? '',
    cancelledAt: row.cancelled_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    documentDate: toDateOnly(row.document_date),
    documentNo: row.doc_no,
    enteredBy: row.entered_by ?? row.created_by ?? '-',
    id: row.id,
    imageCount: row.image_count ?? 0,
    imageNames: [...(row.vehicle_image_names ?? []), ...lineImageNames],
    lines: lineRows,
    partyId: row.doc_type === 'WTI' ? row.supplier_id ?? '' : row.customer_id ?? '',
    partyName: row.party_name,
    remark: row.remark ?? '',
    status: (row.status ?? defaultTicketStatus(row.doc_type as WeightTicketType)) as WeightTicketStatus,
    totals: {
      deductionWeight: toNumber(row.deduct_weight),
      grossWeight: toNumber(row.gross_weight),
      netWeight: toNumber(row.net_weight),
    },
    timeline: [],
    type: row.doc_type as WeightTicketType,
    updatedAt: row.updated_at?.toISOString() ?? null,
    updatedBy: row.updated_by ?? row.created_by ?? row.entered_by ?? '-',
    usedInPurchaseBillCount: usage.purchaseCount,
    usedInSalesBillCount: usage.salesCount,
    vehicleImageCount: row.vehicle_image_count ?? 0,
    vehicleImageNames: row.vehicle_image_names ?? [],
    vehicleNo: row.vehicle_no,
  }
}

export function weightTicketAuditSnapshot(row: ReturnType<typeof mapWeightTicketRow>) {
  return {
    branchId: row.branchId,
    branchName: row.branchName,
    cancelNote: row.cancelNote,
    documentNo: row.documentNo,
    lineCount: row.lines.length,
    partyId: row.partyId,
    partyName: row.partyName,
    status: row.status,
    totals: row.totals,
    type: row.type,
    vehicleNo: row.vehicleNo,
  }
}

export function mutableTicketErrorMessage(action: 'cancel' | 'edit') {
  return action === 'cancel'
    ? 'ยกเลิกไม่ได้ เพราะเอกสารถูกนำไปใช้กับบิลรับซื้อหรือบิลขายแล้ว'
    : 'แก้ไขไม่ได้ เพราะเอกสารถูกนำไปใช้กับบิลรับซื้อหรือบิลขายแล้ว'
}
