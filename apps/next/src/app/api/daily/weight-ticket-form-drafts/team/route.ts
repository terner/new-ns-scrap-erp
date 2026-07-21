import { NextResponse } from 'next/server'

import {
  describeWeightTicketWorkingDraftLastChange,
  hasWeightTicketWorkingDraftContent,
  weightTicketFormDraftPayloadSchema,
} from '@/lib/weight-ticket-drafts'
import { calculateWeightTicketLineTotals } from '@/lib/weight-tickets'
import { apiErrorResponse } from '@/lib/server/api-error'
import {
  AuthContextError,
  authContextErrorResponse,
  getCurrentAuthContext,
  hasPermission,
  type AppAuthContext,
} from '@/lib/server/auth-context'
import { prisma } from '@/lib/server/prisma'
import {
  listActiveBranches,
  listActiveCustomerBranchOptionsByBranchCodes,
  listActiveProductReferences,
  listActiveSupplierBranchOptionsByBranchCodes,
  listActiveWarehouses,
} from '@/lib/server/reference-master-cache'

export const runtime = 'nodejs'

const noStoreHeaders = { 'Cache-Control': 'private, no-store' }
const activeDraftWindowMs = 5 * 60 * 1_000
const maxDraftRows = 100

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { headers: noStoreHeaders, status })
}

function withNoStore(response: Response) {
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

function requireTeamDraftViewPermission(context: AppAuthContext) {
  if (!hasPermission(context, 'daily.weight_tickets.view') || !context.appUser) {
    throw new AuthContextError('ไม่มีสิทธิ์ดูรายการที่กำลังกรอก', 403)
  }
  return context.appUser
}

function normalizeBranchCode(value: string) {
  return value.trim().toUpperCase()
}

function referenceName(
  rows: Array<{ code: string; id: bigint; name: string }>,
  value: string | undefined,
) {
  const normalized = value?.trim() ?? ''
  if (!normalized) return ''
  const code = normalized.toUpperCase()
  const byCode = rows.find((row) => row.code.trim().toUpperCase() === code)
  if (byCode) return byCode.name.trim()
  if (!/^\d+$/.test(normalized)) return ''
  return rows.find((row) => row.id.toString() === normalized)?.name.trim() ?? ''
}

function branchScopedReferenceName(
  rows: Array<{ branchIds: string[]; code: string; id: bigint; name: string }>,
  branchCode: string,
  value: string | undefined,
) {
  const scopedRows = rows.filter((row) => row.branchIds.some((id) => normalizeBranchCode(id) === normalizeBranchCode(branchCode)))
  return referenceName(scopedRows, value)
}

function warehouseName(
  rows: Array<{ branchCode: string | null; code: string; id: bigint; name: string }>,
  branchCode: string,
  value: string | undefined,
) {
  return referenceName(rows.filter((row) => normalizeBranchCode(row.branchCode ?? '') === normalizeBranchCode(branchCode)), value)
}

function ticketDocumentNoFromScopeKey(scopeKey: string) {
  return /^ticket:([A-Za-z0-9_-]{1,80})$/.exec(scopeKey)?.[1] ?? null
}

function isNewWeightTicketDraftScope(scopeKey: string) {
  return /^new:(WTI|WTO)$/.test(scopeKey)
}

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    const appUser = requireTeamDraftViewPermission(context)
    const activeSince = new Date(Date.now() - activeDraftWindowMs)
    const activeBranches = await listActiveBranches()
    const allowedBranchCodes = new Set((context.appUser?.branchIds ?? []).map(normalizeBranchCode).filter(Boolean))
    // Keep the existing WTI/WTO list convention: an empty branch scope is global.
    const visibleBranches = context.isAdmin || allowedBranchCodes.size === 0
      ? activeBranches
      : activeBranches.filter((branch) => allowedBranchCodes.has(normalizeBranchCode(branch.code)))
    const visibleBranchIds = visibleBranches.map((branch) => branch.id)
    const visibleBranchCodes = visibleBranches.map((branch) => branch.code)
    if (!visibleBranchIds.length) return privateJson({ drafts: [], truncated: false })

    const rows = await prisma.weight_ticket_form_drafts.findMany({
      orderBy: { updated_at: 'desc' },
      select: {
        app_users: { select: { display_name: true } },
        payload: true,
        scope_key: true,
        ticket_type: true,
        updated_at: true,
        visibility_branch_id: true,
        visibility_branches: { select: { code: true, name: true } },
      },
      take: maxDraftRows + 1,
      where: {
        app_user_id: { not: appUser.id },
        updated_at: { gte: activeSince },
        visibility_branch_id: { in: visibleBranchIds },
      },
    })

    const parsedRows = rows.map((row) => {
      const payload = weightTicketFormDraftPayloadSchema.parse(row.payload)
      if (row.ticket_type !== payload.type) {
        throw new Error('Working draft type does not match its snapshot.')
      }
      return { ...row, payload }
    })
    const ticketDocumentNos = [...new Set(parsedRows
      .map((row) => ticketDocumentNoFromScopeKey(row.scope_key))
      .filter((documentNo): documentNo is string => Boolean(documentNo)))]
    const tickets = ticketDocumentNos.length
      ? await prisma.weight_tickets.findMany({
        select: { branch_id: true, doc_no: true },
        where: { doc_no: { in: ticketDocumentNos } },
      })
      : []
    const ticketBranchIdByDocumentNo = new Map(tickets.map((ticket) => [ticket.doc_no, ticket.branch_id] as const))
    const [customers, products, suppliers, warehouses] = await Promise.all([
      listActiveCustomerBranchOptionsByBranchCodes(visibleBranchCodes),
      listActiveProductReferences(),
      listActiveSupplierBranchOptionsByBranchCodes(visibleBranchCodes),
      listActiveWarehouses(),
    ])

    const drafts = parsedRows.flatMap((row) => {
      const ticketDocumentNo = ticketDocumentNoFromScopeKey(row.scope_key)
      if (!ticketDocumentNo && !isNewWeightTicketDraftScope(row.scope_key)) return []
      if (!hasWeightTicketWorkingDraftContent(row.payload)) return []
      if (ticketDocumentNo && ticketBranchIdByDocumentNo.get(ticketDocumentNo) !== row.visibility_branch_id) return []
      const branch = row.visibility_branches
      if (!branch) return []

      const allProductNames = [...new Set(row.payload.lines
        .filter((line) => !line.parentId)
        .map((line) => referenceName(products, line.productId))
        .filter(Boolean))]
      const productNames = allProductNames.slice(0, 3)
      const totals = calculateWeightTicketLineTotals(row.payload.lines).totals
      const partyName = row.payload.type === 'WTI'
        ? branchScopedReferenceName(suppliers, branch.code, row.payload.partyId)
        : branchScopedReferenceName(customers, branch.code, row.payload.partyId)
      const lastChange = {
        ...row.payload.lastChange,
        // Never fall back to text from the draft snapshot: it may originate
        // from a client payload. The team feed only receives master-derived labels.
        productName: referenceName(products, row.payload.lastChange.productId),
        warehouseName: warehouseName(warehouses, branch.code, row.payload.lastChange.warehouseId),
      }
      return [{
        activity: row.payload.activity,
        activityDetail: row.payload.activityDetail,
        activityDescription: describeWeightTicketWorkingDraftLastChange(lastChange),
        branchId: branch.code,
        branchName: branch.name,
        drafterName: row.app_users.display_name?.trim() || 'ผู้ใช้งานในระบบ',
        documentNo: ticketDocumentNo ?? '',
        grossWeight: totals.grossWeight,
        lineCount: row.payload.lines.filter((line) => line.productId.trim()).length,
        netWeight: totals.netWeight,
        otherProductCount: Math.max(0, allProductNames.length - productNames.length),
        partyName,
        productNames,
        savedAt: row.updated_at.toISOString(),
        type: row.payload.type,
      }]
    })

    return privateJson({
      drafts: drafts.slice(0, maxDraftRows),
      // The query has a bounded candidate set. Keep the warning conservative:
      // rows suppressed by the trusted checks above can be followed by a safe
      // snapshot outside the query window.
      truncated: rows.length > maxDraftRows,
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return withNoStore(authContextErrorResponse(caught))
    return withNoStore(apiErrorResponse(caught, 'โหลดรายการที่กำลังกรอกไม่สำเร็จ', 400))
  }
}
