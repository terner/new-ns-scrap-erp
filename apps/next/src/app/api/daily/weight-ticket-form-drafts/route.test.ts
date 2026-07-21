import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class AuthContextError extends Error {
    constructor(message: string, readonly status: number) {
      super(message)
      this.name = 'AuthContextError'
    }
  }

  return {
    AuthContextError,
    apiErrorResponse: vi.fn(),
    authContextErrorResponse: vi.fn(),
    findActiveBranchReferenceByCodeOrId: vi.fn(),
    formDrafts: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    getCurrentAuthContext: vi.fn(),
    hasPermission: vi.fn(),
    weightTickets: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  }
})

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
  },
}))

vi.mock('@/lib/server/api-error', () => ({
  apiErrorResponse: mocks.apiErrorResponse,
}))

vi.mock('@/lib/server/auth-context', () => ({
  AuthContextError: mocks.AuthContextError,
  authContextErrorResponse: mocks.authContextErrorResponse,
  getCurrentAuthContext: mocks.getCurrentAuthContext,
  hasPermission: mocks.hasPermission,
}))

vi.mock('@/lib/server/branch-reference', () => ({
  findActiveBranchReferenceByCodeOrId: mocks.findActiveBranchReferenceByCodeOrId,
}))

vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    weight_ticket_form_drafts: mocks.formDrafts,
    weight_tickets: mocks.weightTickets,
  },
}))

import { DELETE, GET, PUT } from './route'

const ownerId = 47n
const scopeKey = 'new:WTI'
const payload = {
  activity: 'document' as const,
  activityDetail: 'document' as const,
  branchId: 'BR-001',
  branchName: 'สำนักงานใหญ่',
  godownName: 'ลานหลัก',
  lines: [{
    containerDeductionWeight: '',
    deductionMode: 'none' as const,
    deductionValue: '',
    grossWeight: '',
    id: 'line-1',
    imageNames: [],
    impurityId: '',
    impurityName: '',
    impurityProductId: '',
    impurityProductName: '',
    impurityPurchaseAction: 'none' as const,
    note: '',
    productId: '',
    productName: '',
    warehouseId: '',
    warehouseName: '',
    warehouseType: '',
  }],
  partyId: 'SUP-001',
  partyName: 'ผู้ขายทดสอบ',
  remark: '',
  lastChange: { kind: 'document' as const },
  type: 'WTI' as const,
  vehicleImageNames: [],
  vehicleNo: '',
}

function authContext(permissionCodes: string[], branchIds: string[] = ['BR-001']) {
  return {
    appUser: { branchIds, id: ownerId },
    isAdmin: false,
    permissionCodes: new Set(permissionCodes),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.apiErrorResponse.mockImplementation((_caught: unknown, fallback: string, status = 500) => Response.json({ error: fallback }, { status }))
  mocks.authContextErrorResponse.mockImplementation((caught: { message: string; status: number }) => Response.json({ error: caught.message }, { status: caught.status }))
  mocks.getCurrentAuthContext.mockResolvedValue(authContext([
    'daily.weight_tickets.create',
    'daily.weight_tickets.view',
  ]))
  mocks.hasPermission.mockImplementation((context: { isAdmin: boolean; permissionCodes: Set<string> }, permission: string) => (
    context.isAdmin || context.permissionCodes.has(permission)
  ))
  mocks.findActiveBranchReferenceByCodeOrId.mockResolvedValue({
    code: 'BR-001',
    id: 101n,
    name: 'สำนักงานใหญ่',
  })
  mocks.formDrafts.create.mockResolvedValue(null)
  mocks.formDrafts.deleteMany.mockResolvedValue({ count: 1 })
  mocks.formDrafts.findFirst.mockResolvedValue(null)
  mocks.formDrafts.updateMany.mockResolvedValue({ count: 1 })
  mocks.weightTickets.findFirst.mockResolvedValue(null)
})

describe('weight ticket form draft route', () => {
  it('loads only the current owner\'s matching draft and marks it private no-store', async () => {
    const savedAt = new Date('2026-07-21T03:30:00.000Z')
    mocks.formDrafts.findFirst.mockResolvedValue({
      payload,
      revision: 3,
      scope_key: scopeKey,
      updated_at: savedAt,
    })

    const response = await GET(new Request(`http://localhost/api/daily/weight-ticket-form-drafts?scopeKey=${scopeKey}`))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(mocks.formDrafts.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { app_user_id: ownerId, scope_key: scopeKey },
    }))
    await expect(response.json()).resolves.toEqual({
      draft: {
        payload,
        revision: 3,
        savedAt: savedAt.toISOString(),
        scopeKey,
      },
    })
  })

  it('rejects a stale revision without updating another draft snapshot', async () => {
    mocks.formDrafts.findFirst.mockResolvedValue({ id: 'draft-1', revision: 3 })

    const response = await PUT(new Request('http://localhost/api/daily/weight-ticket-form-drafts', {
      body: JSON.stringify({ payload, revision: 2, scopeKey }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    }))

    expect(response.status).toBe(409)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    await expect(response.json()).resolves.toMatchObject({ code: 'CONFLICT' })
    expect(mocks.formDrafts.updateMany).not.toHaveBeenCalled()
  })

  it('derives the team-visible last change on the server instead of trusting the client activity', async () => {
    const previousPayload = {
      ...payload,
      branchId: '101',
      lastChange: { kind: 'document' as const },
      lines: [{
        ...payload.lines[0],
        grossWeight: '100',
        productId: 'SCRAP-01',
        productName: 'ทองแดง',
      }],
    }
    const nextPayload = {
      ...payload,
      activity: 'remark' as const,
      activityDetail: 'remark' as const,
      lines: [{
        ...payload.lines[0],
        grossWeight: '125.5',
        productId: 'SCRAP-01',
        productName: 'ทองแดง',
      }],
    }
    mocks.formDrafts.findFirst.mockResolvedValue({ id: 'draft-1', payload: previousPayload, revision: 1 })

    const response = await PUT(new Request('http://localhost/api/daily/weight-ticket-form-drafts', {
      body: JSON.stringify({ payload: nextPayload, revision: 1, scopeKey }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      payload: {
        activity: 'weight',
        activityDetail: 'weight',
        lastChange: { grossWeightKg: 125.5, kind: 'weight', productId: 'SCRAP-01', productName: 'ทองแดง' },
      },
    })
    expect(mocks.formDrafts.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        payload: expect.objectContaining({
          activity: 'weight',
          activityDetail: 'weight',
          lastChange: { grossWeightKg: 125.5, kind: 'weight', productId: 'SCRAP-01', productName: 'ทองแดง' },
        }),
      }),
    }))
  })

  it('treats a concurrent first-save unique conflict as a draft conflict without touching a real ticket', async () => {
    mocks.formDrafts.create.mockRejectedValue(Object.assign(new Error('duplicate draft'), { code: 'P2002' }))

    const response = await PUT(new Request('http://localhost/api/daily/weight-ticket-form-drafts', {
      body: JSON.stringify({ payload, revision: 0, scopeKey }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    }))

    expect(response.status).toBe(409)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(mocks.formDrafts.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ app_user_id: ownerId, scope_key: scopeKey }),
    }))
    expect(mocks.weightTickets.create).not.toHaveBeenCalled()
    expect(mocks.weightTickets.update).not.toHaveBeenCalled()
    expect(mocks.weightTickets.updateMany).not.toHaveBeenCalled()
  })

  it('deletes only the current owner\'s matching working draft', async () => {
    const response = await DELETE(new Request(`http://localhost/api/daily/weight-ticket-form-drafts?scopeKey=${scopeKey}&revision=3`))

    expect(response.status).toBe(204)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(mocks.formDrafts.deleteMany).toHaveBeenCalledWith({
      where: { app_user_id: ownerId, revision: 3, scope_key: scopeKey },
    })
  })

  it('does not let a stale tab delete a newer draft from another tab', async () => {
    mocks.formDrafts.deleteMany.mockResolvedValue({ count: 0 })
    mocks.formDrafts.findFirst.mockResolvedValue({ revision: 4 })

    const response = await DELETE(new Request(`http://localhost/api/daily/weight-ticket-form-drafts?scopeKey=${scopeKey}&revision=3`))

    expect(response.status).toBe(409)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    await expect(response.json()).resolves.toMatchObject({ code: 'CONFLICT' })
  })

  it('requires the same view access as the form route plus a write action', async () => {
    mocks.getCurrentAuthContext.mockResolvedValue(authContext(['daily.weight_tickets.create']))

    const response = await GET(new Request(`http://localhost/api/daily/weight-ticket-form-drafts?scopeKey=${scopeKey}`))

    expect(response.status).toBe(403)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(mocks.formDrafts.findFirst).not.toHaveBeenCalled()
  })

  it('requires create for a new draft and update for an existing ticket draft', async () => {
    mocks.getCurrentAuthContext.mockResolvedValue(authContext([
      'daily.weight_tickets.update',
      'daily.weight_tickets.view',
    ]))

    const newDraftResponse = await PUT(new Request('http://localhost/api/daily/weight-ticket-form-drafts', {
      body: JSON.stringify({ payload, revision: 0, scopeKey }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    }))

    expect(newDraftResponse.status).toBe(403)
    expect(mocks.formDrafts.findFirst).not.toHaveBeenCalled()

    mocks.getCurrentAuthContext.mockResolvedValue(authContext([
      'daily.weight_tickets.create',
      'daily.weight_tickets.view',
    ]))
    const ticketDraftResponse = await GET(new Request('http://localhost/api/daily/weight-ticket-form-drafts?scopeKey=ticket:WTI2607-0001'))

    expect(ticketDraftResponse.status).toBe(403)
    expect(mocks.weightTickets.findFirst).not.toHaveBeenCalled()
  })

  it('applies the same scope-specific permission before discarding a draft', async () => {
    mocks.getCurrentAuthContext.mockResolvedValue(authContext([
      'daily.weight_tickets.create',
      'daily.weight_tickets.view',
    ]))

    const ticketDeleteResponse = await DELETE(new Request('http://localhost/api/daily/weight-ticket-form-drafts?scopeKey=ticket:WTI2607-0001&revision=1'))

    expect(ticketDeleteResponse.status).toBe(403)
    expect(mocks.formDrafts.deleteMany).not.toHaveBeenCalled()

    mocks.getCurrentAuthContext.mockResolvedValue(authContext([
      'daily.weight_tickets.update',
      'daily.weight_tickets.view',
    ]))
    const newDeleteResponse = await DELETE(new Request(`http://localhost/api/daily/weight-ticket-form-drafts?scopeKey=${scopeKey}&revision=1`))

    expect(newDeleteResponse.status).toBe(403)
    expect(mocks.formDrafts.deleteMany).not.toHaveBeenCalled()
  })

  it('does not save a draft into a branch outside the writer scope', async () => {
    mocks.getCurrentAuthContext.mockResolvedValue(authContext([
      'daily.weight_tickets.create',
      'daily.weight_tickets.view',
    ], ['BR-001']))
    mocks.findActiveBranchReferenceByCodeOrId.mockResolvedValue({
      code: 'BR-002',
      id: 202n,
      name: 'สาขาสอง',
    })

    const response = await PUT(new Request('http://localhost/api/daily/weight-ticket-form-drafts', {
      body: JSON.stringify({ payload, revision: 0, scopeKey }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    }))

    expect(response.status).toBe(403)
    expect(mocks.formDrafts.findFirst).not.toHaveBeenCalled()
  })

  it('only accepts recognized new or ticket draft scopes', async () => {
    const response = await PUT(new Request('http://localhost/api/daily/weight-ticket-form-drafts', {
      body: JSON.stringify({ payload, revision: 0, scopeKey: 'other:WTI' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    }))

    expect(response.status).toBe(400)
    expect(mocks.weightTickets.findFirst).not.toHaveBeenCalled()
    expect(mocks.formDrafts.findFirst).not.toHaveBeenCalled()
  })

  it('stores the server-resolved branch as the visibility branch for a new draft', async () => {
    const savedAt = new Date('2026-07-21T04:00:00.000Z')
    const canonicalPayload = {
      ...payload,
      activity: 'document' as const,
      activityDetail: 'branch' as const,
      branchId: '101',
      branchName: 'สำนักงานใหญ่',
      lastChange: { kind: 'branch' as const },
    }
    mocks.formDrafts.create.mockResolvedValue({
      payload: canonicalPayload,
      revision: 1,
      scope_key: scopeKey,
      updated_at: savedAt,
    })

    const response = await PUT(new Request('http://localhost/api/daily/weight-ticket-form-drafts', {
      body: JSON.stringify({ payload, revision: 0, scopeKey }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    }))

    expect(response.status).toBe(200)
    expect(mocks.formDrafts.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        payload: canonicalPayload,
        visibility_branch_id: 101n,
      }),
    }))
    await expect(response.json()).resolves.toMatchObject({ payload: canonicalPayload })
  })

  it('does not read a private ticket draft if the persisted ticket is outside the writer scope', async () => {
    mocks.getCurrentAuthContext.mockResolvedValue(authContext([
      'daily.weight_tickets.update',
      'daily.weight_tickets.view',
    ]))

    const response = await GET(new Request('http://localhost/api/daily/weight-ticket-form-drafts?scopeKey=ticket:WTI2607-0001'))

    expect(response.status).toBe(404)
    expect(mocks.weightTickets.findFirst).toHaveBeenCalledWith({
      select: { branch_id: true, doc_type: true },
      where: {
        branches: { code: { in: ['BR-001'] } },
        doc_no: 'WTI2607-0001',
      },
    })
    expect(mocks.formDrafts.findFirst).not.toHaveBeenCalled()
  })

  it('does not narrow an administrator to an incidental branch mapping when reading an edit draft', async () => {
    mocks.getCurrentAuthContext.mockResolvedValue({
      ...authContext([
        'daily.weight_tickets.update',
        'daily.weight_tickets.view',
      ], ['BR-001']),
      isAdmin: true,
    })
    mocks.weightTickets.findFirst.mockResolvedValue({ branch_id: 202n, doc_type: 'WTI' })

    const response = await GET(new Request('http://localhost/api/daily/weight-ticket-form-drafts?scopeKey=ticket:WTI2607-0001'))

    expect(response.status).toBe(200)
    expect(mocks.weightTickets.findFirst).toHaveBeenCalledWith({
      select: { branch_id: true, doc_type: true },
      where: { doc_no: 'WTI2607-0001' },
    })
  })

  it('does not save a ticket draft when its persisted ticket is missing or outside the writer scope', async () => {
    const ticketScopeKey = 'ticket:WTI2607-0001'
    mocks.getCurrentAuthContext.mockResolvedValue(authContext([
      'daily.weight_tickets.update',
      'daily.weight_tickets.view',
    ]))

    const response = await PUT(new Request('http://localhost/api/daily/weight-ticket-form-drafts', {
      body: JSON.stringify({ payload, revision: 0, scopeKey: ticketScopeKey }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    }))

    expect(response.status).toBe(404)
    expect(mocks.formDrafts.findFirst).not.toHaveBeenCalled()
    expect(mocks.formDrafts.create).not.toHaveBeenCalled()
  })

  it('rejects a ticket draft with a type different from its persisted document', async () => {
    mocks.weightTickets.findFirst.mockResolvedValue({ branch_id: 101n, doc_type: 'WTO' })
    mocks.getCurrentAuthContext.mockResolvedValue(authContext([
      'daily.weight_tickets.update',
      'daily.weight_tickets.view',
    ]))

    const response = await PUT(new Request('http://localhost/api/daily/weight-ticket-form-drafts', {
      body: JSON.stringify({ payload, revision: 0, scopeKey: 'ticket:WTI2607-0001' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    }))

    expect(response.status).toBe(400)
    expect(mocks.formDrafts.findFirst).not.toHaveBeenCalled()
  })

  it('keeps an authorized proposed branch in an edit draft but uses the persisted ticket branch for disclosure', async () => {
    const ticketScopeKey = 'ticket:WTI2607-0001'
    const proposedBranchPayload = {
      ...payload,
      activity: 'document' as const,
      activityDetail: 'branch' as const,
      branchId: 'BR-002',
      branchName: 'สาขาสอง',
      lastChange: { kind: 'branch' as const },
    }
    const savedAt = new Date('2026-07-21T04:00:00.000Z')
    mocks.getCurrentAuthContext.mockResolvedValue(authContext([
      'daily.weight_tickets.update',
      'daily.weight_tickets.view',
    ], ['BR-001', 'BR-002']))
    mocks.weightTickets.findFirst.mockResolvedValue({ branch_id: 101n, doc_type: 'WTI' })
    mocks.findActiveBranchReferenceByCodeOrId.mockResolvedValue({
      code: 'BR-002',
      id: 202n,
      name: 'สาขาสอง',
    })
    mocks.formDrafts.create.mockResolvedValue({
      payload: proposedBranchPayload,
      revision: 1,
      scope_key: ticketScopeKey,
      updated_at: savedAt,
    })

    const response = await PUT(new Request('http://localhost/api/daily/weight-ticket-form-drafts', {
      body: JSON.stringify({ payload: proposedBranchPayload, revision: 0, scopeKey: ticketScopeKey }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    }))

    expect(response.status).toBe(200)
    expect(mocks.formDrafts.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        payload: proposedBranchPayload,
        visibility_branch_id: 101n,
      }),
    }))
  })
})
