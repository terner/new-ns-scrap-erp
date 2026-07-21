import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class AuthContextError extends Error {
    constructor(message: string, readonly status: number) {
      super(message)
      this.name = 'AuthContextError'
    }
  }

  return {
    activeBranches: vi.fn(),
    activeWarehouses: vi.fn(),
    activeProducts: vi.fn(),
    AuthContextError,
    apiErrorResponse: vi.fn(),
    authContextErrorResponse: vi.fn(),
    formDrafts: { findMany: vi.fn() },
    getCurrentAuthContext: vi.fn(),
    hasPermission: vi.fn(),
    customerBranchOptions: vi.fn(),
    supplierBranchOptions: vi.fn(),
    weightTickets: { findMany: vi.fn() },
  }
})

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
  },
}))

vi.mock('@/lib/server/api-error', () => ({ apiErrorResponse: mocks.apiErrorResponse }))

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

vi.mock('@/lib/server/reference-master-cache', () => ({
  listActiveBranches: mocks.activeBranches,
  listActiveWarehouses: mocks.activeWarehouses,
  listActiveCustomerBranchOptionsByBranchCodes: mocks.customerBranchOptions,
  listActiveProductReferences: mocks.activeProducts,
  listActiveSupplierBranchOptionsByBranchCodes: mocks.supplierBranchOptions,
}))

import { GET } from './route'

const viewerId = 47n
const savedAt = new Date('2026-07-21T03:30:00.000Z')

function payload(branchId: string) {
  return {
    activity: 'weight' as const,
    activityDetail: 'weight' as const,
    branchId,
    branchName: 'CLIENT_BRANCH_LABEL_MUST_NOT_LEAK',
    godownName: 'Main yard',
    lines: [{
      containerDeductionWeight: '10',
      deductionMode: 'none' as const,
      deductionValue: '',
      grossWeight: '120',
      id: 'line-1',
      imageNames: [],
      impurityId: '',
      impurityName: '',
      impurityProductId: '',
      impurityProductName: '',
      impurityPurchaseAction: 'none' as const,
      note: 'Private line note',
      productId: 'SCRAP-01',
      productName: 'CLIENT_PRODUCT_LABEL_MUST_NOT_LEAK',
      warehouseId: 'RM-01',
      warehouseName: 'CLIENT_WAREHOUSE_LABEL_MUST_NOT_LEAK',
      warehouseType: '',
    }],
    partyId: 'SUP-001',
    partyName: 'CLIENT_PARTY_LABEL_MUST_NOT_LEAK',
    remark: 'Private remark',
    lastChange: {
      kind: 'weight' as const,
      productId: 'SCRAP-01',
      productName: 'CLIENT_ACTIVITY_LABEL_MUST_NOT_LEAK',
    },
    type: 'WTI' as const,
    vehicleImageNames: [],
    vehicleNo: 'LEAK_VEHICLE',
  }
}

function draftRow(overrides: Record<string, unknown> = {}) {
  return {
    app_users: { display_name: 'Somchai' },
    payload: payload('1'),
    scope_key: 'new:WTI',
    ticket_type: 'WTI',
    updated_at: savedAt,
    visibility_branch_id: 1n,
    visibility_branches: { code: 'BR-001', name: 'Head office' },
    ...overrides,
  }
}

function authContext(permissionCodes: string[], branchIds: string[] = []) {
  return {
    appUser: { branchIds, id: viewerId },
    isAdmin: false,
    permissionCodes: new Set(permissionCodes),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.apiErrorResponse.mockImplementation((_caught: unknown, fallback: string, status = 500) => Response.json({ error: fallback }, { status }))
  mocks.authContextErrorResponse.mockImplementation((caught: { message: string; status: number }) => Response.json({ error: caught.message }, { status: caught.status }))
  mocks.getCurrentAuthContext.mockResolvedValue(authContext(['daily.weight_tickets.view'], ['BR-001']))
  mocks.hasPermission.mockImplementation((context: { isAdmin: boolean; permissionCodes: Set<string> }, permission: string) => (
    context.isAdmin || context.permissionCodes.has(permission)
  ))
  mocks.activeBranches.mockResolvedValue([
    { code: 'BR-001', id: 1n, name: 'Head office' },
    { code: 'BR-002', id: 2n, name: 'Other branch' },
  ])
  mocks.customerBranchOptions.mockResolvedValue([])
  mocks.supplierBranchOptions.mockResolvedValue([{ branchIds: ['BR-001'], code: 'SUP-001', id: 11n, name: 'Supplier verified by master' }])
  mocks.activeWarehouses.mockResolvedValue([{ branchCode: 'BR-001', code: 'RM-01', id: 21n, name: 'Warehouse verified by master', type: 'RM' }])
  mocks.activeProducts.mockResolvedValue([{ active: true, code: 'SCRAP-01', id: 31n, metalGroup: null, name: 'Copper verified by master', type: null, unit: 'KG' }])
  mocks.weightTickets.findMany.mockResolvedValue([])
})

describe('weight ticket team working-drafts route', () => {
  it('returns only a safe summary of another user\'s current draft in an allowed branch', async () => {
    mocks.formDrafts.findMany.mockResolvedValue([draftRow()])

    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(mocks.formDrafts.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 101,
      where: {
        app_user_id: { not: viewerId },
        updated_at: { gte: expect.any(Date) },
        visibility_branch_id: { in: [1n] },
      },
    }))
    const body = await response.json()
    expect(body).toMatchObject({
      drafts: [{
        activity: 'weight',
        activityDetail: 'weight',
        branchId: 'BR-001',
        branchName: 'Head office',
        drafterName: 'Somchai',
        documentNo: '',
        grossWeight: 120,
        lineCount: 1,
        netWeight: 110,
        otherProductCount: 0,
        partyName: 'Supplier verified by master',
        productNames: ['Copper verified by master'],
        savedAt: savedAt.toISOString(),
        type: 'WTI',
      }],
      truncated: false,
    })
    expect(body.drafts[0].activityDescription).toContain('Copper verified by master')
    expect(JSON.stringify(body)).not.toContain('CLIENT_')
    expect(body.drafts[0]).not.toHaveProperty('payload')
    expect(body.drafts[0]).not.toHaveProperty('remark')
    expect(body.drafts[0]).not.toHaveProperty('scopeKey')
    expect(body.drafts[0]).not.toHaveProperty('vehicleNo')
  })

  it('keeps an edit draft visible only while its ticket remains in the trusted visibility branch', async () => {
    mocks.formDrafts.findMany.mockResolvedValue([draftRow({
      payload: payload('2'),
      scope_key: 'ticket:WTI2607-0011',
    })])
    mocks.weightTickets.findMany.mockResolvedValue([{ branch_id: 1n, doc_no: 'WTI2607-0011' }])

    const response = await GET()

    await expect(response.json()).resolves.toMatchObject({
      drafts: [{ branchId: 'BR-001', documentNo: 'WTI2607-0011' }],
    })
    expect(mocks.weightTickets.findMany).toHaveBeenCalledWith({
      select: { branch_id: true, doc_no: true },
      where: { doc_no: { in: ['WTI2607-0011'] } },
    })
  })

  it('suppresses an edit draft after the persisted ticket has moved to another branch', async () => {
    mocks.formDrafts.findMany.mockResolvedValue([draftRow({ scope_key: 'ticket:WTI2607-0011' })])
    mocks.weightTickets.findMany.mockResolvedValue([{ branch_id: 2n, doc_no: 'WTI2607-0011' }])

    const response = await GET()

    await expect(response.json()).resolves.toEqual({ drafts: [], truncated: false })
  })

  it('keeps an empty recovery snapshot private to its owner', async () => {
    const empty = payload('')
    empty.godownName = ''
    empty.partyId = ''
    empty.partyName = ''
    empty.remark = ''
    empty.vehicleNo = ''
    empty.lines = [{
      ...empty.lines[0],
      containerDeductionWeight: '',
      grossWeight: '',
      note: '',
      productId: '',
      productName: '',
    }]
    mocks.formDrafts.findMany.mockResolvedValue([draftRow({ payload: empty })])

    const response = await GET()

    await expect(response.json()).resolves.toEqual({ drafts: [], truncated: false })
  })

  it('marks the response as truncated when more than one hundred eligible snapshots exist', async () => {
    mocks.formDrafts.findMany.mockResolvedValue(Array.from({ length: 101 }, () => draftRow()))

    const response = await GET()
    const body = await response.json()

    expect(body.truncated).toBe(true)
    expect(body.drafts).toHaveLength(100)
  })

  it('keeps the partial-results warning when a bounded candidate row is suppressed', async () => {
    const empty = payload('')
    empty.godownName = ''
    empty.partyId = ''
    empty.partyName = ''
    empty.remark = ''
    empty.vehicleNo = ''
    empty.lines = [{
      ...empty.lines[0],
      containerDeductionWeight: '',
      grossWeight: '',
      note: '',
      productId: '',
      productName: '',
    }]
    mocks.formDrafts.findMany.mockResolvedValue([
      ...Array.from({ length: 100 }, () => draftRow()),
      draftRow({ payload: empty }),
    ])

    const response = await GET()
    const body = await response.json()

    expect(body.truncated).toBe(true)
    expect(body.drafts).toHaveLength(100)
  })

  it('rejects a viewer without weight-ticket view permission before querying drafts', async () => {
    mocks.getCurrentAuthContext.mockResolvedValue(authContext([], ['BR-001']))

    const response = await GET()

    expect(response.status).toBe(403)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(mocks.formDrafts.findMany).not.toHaveBeenCalled()
  })

  it('surfaces malformed stored data instead of silently showing an incomplete feed', async () => {
    mocks.formDrafts.findMany.mockResolvedValue([draftRow({ payload: { invalid: true } })])

    const response = await GET()

    expect(response.status).toBe(400)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(mocks.activeBranches).toHaveBeenCalledOnce()
  })
})
