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
  type: 'WTI' as const,
  vehicleImageNames: [],
  vehicleNo: '',
}

function authContext(permissionCodes: string[]) {
  return {
    appUser: { id: ownerId },
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
  mocks.formDrafts.create.mockResolvedValue(null)
  mocks.formDrafts.deleteMany.mockResolvedValue({ count: 1 })
  mocks.formDrafts.findFirst.mockResolvedValue(null)
  mocks.formDrafts.updateMany.mockResolvedValue({ count: 1 })
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
})
