import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  findActiveTarget: vi.fn(),
  findDefaultTargets: vi.fn(),
}))

const routing = vi.hoisted(() => ({
  resolveWeightTicketTargets: vi.fn(),
}))

vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    line_targets: {
      findFirst: db.findActiveTarget,
      findMany: db.findDefaultTargets,
    },
  },
}))

vi.mock('@/lib/server/line-notification-routing', () => ({
  resolveLineTargetsForWeightTicket: routing.resolveWeightTicketTargets,
}))

vi.mock('@/lib/weight-ticket-print', () => ({ buildReceiptPrintHtml: vi.fn() }))
vi.mock('@/lib/weight-tickets', () => ({ decodeStoredImageAsset: vi.fn(), formatDateDisplay: vi.fn(), formatWeight: vi.fn(), typeLabels: {} }))
vi.mock('@/lib/server/reference-master-cache', () => ({ findActiveBranchReferenceByCodeOrId: vi.fn() }))
vi.mock('@/lib/server/supabase-admin', () => ({ getSupabaseAdminClient: vi.fn() }))
vi.mock('@/lib/server/weight-tickets', () => ({ findScopedWeightTicket: vi.fn(), getWeightTicketUsageCounts: vi.fn(), mapWeightTicketRow: vi.fn() }))
vi.mock('@/lib/server/google-sheets-sync', () => ({ syncWeightTicketToGoogleSheets: vi.fn() }))
vi.mock('@/lib/server/pdf/weight-ticket-pdf', () => ({ generateWeightTicketPdf: vi.fn() }))

import { resolveWeightTicketLineTargets, sendLinePush } from './weight-ticket-line-notification'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('weight-ticket LINE target resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects an explicit target that is not a registered active target', async () => {
    db.findActiveTarget.mockResolvedValue(null)

    await expect(resolveWeightTicketLineTargets({ type: 'WTI' }, 'C-OLD-OA-GROUP')).resolves.toEqual([])
    expect(db.findActiveTarget).toHaveBeenCalledWith({
      where: {
        is_active: true,
        notify_wti: true,
        target_id: 'C-OLD-OA-GROUP',
      },
      select: { target_id: true },
    })
    expect(routing.resolveWeightTicketTargets).not.toHaveBeenCalled()
  })

  it('keeps only active rule and default targets when routing contains a stale fallback', async () => {
    routing.resolveWeightTicketTargets.mockResolvedValue([
      { targetId: 'C-RULE', ruleId: '1' },
      { targetId: 'C-DEFAULT', ruleId: null },
      { targetId: 'C-OLD-OA-GROUP', ruleId: null },
    ])
    db.findDefaultTargets.mockResolvedValue([
      { is_default: false, target_id: 'C-RULE' },
      { is_default: true, target_id: 'C-DEFAULT' },
    ])

    await expect(resolveWeightTicketLineTargets({ type: 'WTI' })).resolves.toEqual([
      'C-RULE',
      'C-DEFAULT',
    ])
    expect(db.findDefaultTargets).toHaveBeenCalledWith({
      where: {
        target_id: { in: ['C-RULE', 'C-DEFAULT', 'C-OLD-OA-GROUP'] },
        is_active: true,
        notify_wti: true,
      },
      select: { is_default: true, target_id: true },
    })
  })

  it('excludes routed WTO targets whose WTO notification switch is off', async () => {
    routing.resolveWeightTicketTargets.mockResolvedValue([
      { targetId: 'C-WTO-DISABLED', ruleId: '1' },
    ])
    db.findDefaultTargets.mockResolvedValue([])

    await expect(resolveWeightTicketLineTargets({ type: 'WTO' })).resolves.toEqual([])
    expect(db.findDefaultTargets).toHaveBeenCalledWith({
      where: {
        target_id: { in: ['C-WTO-DISABLED'] },
        is_active: true,
        notify_wto: true,
      },
      select: { is_default: true, target_id: true },
    })
  })

  it('normalizes LINE push failures without reading or exposing the raw response body', async () => {
    const responseText = vi.fn().mockResolvedValue('Authorization: Bearer leaked-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      headers: new Headers(),
      ok: false,
      status: 401,
      text: responseText,
    }))

    const error = await sendLinePush('C-target', [{ type: 'text', text: 'test' }], 'submitted-token')
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) throw new Error('Expected sendLinePush to reject')
    expect(error.message).toBe('LINE Push Message ไม่สำเร็จ (401)')
    expect(error.message).not.toContain('leaked-token')
    expect(responseText).not.toHaveBeenCalled()
  })

  it('normalizes LINE push network failures without exposing request credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
      new Error('network failed with Authorization: Bearer submitted-token')
    ))

    const error = await sendLinePush('C-target', [{ type: 'text', text: 'test' }], 'submitted-token')
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) throw new Error('Expected sendLinePush to reject')
    expect(error.message).toBe('เชื่อมต่อ LINE Push API ไม่สำเร็จ')
    expect(error.message).not.toContain('submitted-token')
    expect(error.message).not.toContain('Authorization')
  })
})
