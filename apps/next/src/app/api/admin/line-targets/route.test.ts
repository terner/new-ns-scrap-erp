import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  acquireReadLock: vi.fn(),
  findSetting: vi.fn(),
  findTarget: vi.fn(),
  getCurrentAuthContext: vi.fn(),
  requirePermission: vi.fn(),
  sendLinePush: vi.fn(),
  targetUpdate: vi.fn(),
  targetUpdateMany: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/server/line-credential-lock', () => ({
  acquireLineCredentialReadLock: mocks.acquireReadLock,
}))

vi.mock('@/lib/server/api-error', () => ({
  apiErrorResponse: vi.fn((caught: unknown, message: string, status: number) => Response.json({
    error: caught instanceof Error ? caught.message : message,
  }, { status })),
}))

vi.mock('@/lib/server/auth-context', () => ({
  AuthContextError: class AuthContextError extends Error {},
  authContextErrorResponse: vi.fn(),
  getCurrentAuthContext: mocks.getCurrentAuthContext,
  requirePermission: mocks.requirePermission,
}))

vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    line_targets: {
      findUnique: mocks.findTarget,
      update: mocks.targetUpdate,
      updateMany: mocks.targetUpdateMany,
    },
    system_settings: { findUnique: mocks.findSetting },
  },
}))

vi.mock('@/lib/server/weight-ticket-line-notification', () => ({
  sendLinePush: mocks.sendLinePush,
}))

vi.mock('@/lib/server/line-target-sync', () => ({
  resolveLineAccessToken: vi.fn(),
  syncLineTargetsFromAPI: vi.fn(),
}))

import { PATCH } from './route'

function request(action: 'set-default' | 'test') {
  return new Request('http://localhost/api/admin/line-targets', {
    body: JSON.stringify({ action, id: '1' }),
    headers: { 'content-type': 'application/json' },
    method: 'PATCH',
  })
}

describe('PATCH /api/admin/line-targets inactive target safety', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentAuthContext.mockResolvedValue({ appUser: { email: 'tester@example.com' } })
    mocks.acquireReadLock.mockResolvedValue(undefined)
    mocks.transaction.mockImplementation((input: unknown) => (
      typeof input === 'function'
        ? (input as (transaction: unknown) => unknown)({
            line_targets: { findUnique: mocks.findTarget },
            system_settings: { findUnique: mocks.findSetting },
          })
        : Promise.resolve([])
    ))
    mocks.findTarget.mockResolvedValue({
      display_name: 'กลุ่มของ OA เก่า',
      id: 1n,
      is_active: false,
      target_id: 'C-old-group',
      target_type: 'group',
    })
  })

  it('rejects making an inactive target the default', async () => {
    const response = await PATCH(request('set-default'))

    expect(response.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.targetUpdate).not.toHaveBeenCalled()
  })

  it('rejects sending a test message to an inactive target', async () => {
    const response = await PATCH(request('test'))

    expect(response.status).toBe(400)
    expect(mocks.findSetting).not.toHaveBeenCalled()
    expect(mocks.sendLinePush).not.toHaveBeenCalled()
  })

  it('waits for the credential read lock before reading the current token and target or pushing', async () => {
    let releaseLock!: () => void
    mocks.acquireReadLock.mockImplementation(() => new Promise<void>((resolve) => {
      releaseLock = resolve
    }))
    mocks.findTarget.mockResolvedValue({
      display_name: 'Current OA group',
      id: 1n,
      is_active: true,
      target_id: 'C-current-group',
      target_type: 'group',
    })
    mocks.findSetting.mockResolvedValue({ value: 'locked-current-token' })
    mocks.sendLinePush.mockResolvedValue({ lineRequestId: 'line-request-1' })

    const responsePromise = PATCH(request('test'))

    await vi.waitFor(() => expect(mocks.acquireReadLock).toHaveBeenCalledTimes(1))
    expect(mocks.findTarget).not.toHaveBeenCalled()
    expect(mocks.findSetting).not.toHaveBeenCalled()
    expect(mocks.sendLinePush).not.toHaveBeenCalled()

    releaseLock()
    const response = await responsePromise

    expect(response.status).toBe(200)
    expect(mocks.findTarget).toHaveBeenCalledWith({ where: { id: 1n } })
    expect(mocks.findSetting).toHaveBeenCalledWith({
      where: { key: 'LINE_CHANNEL_ACCESS_TOKEN' },
    })
    expect(mocks.sendLinePush).toHaveBeenCalledWith(
      'C-current-group',
      expect.any(Array),
      'locked-current-token',
    )
    await expect(response.json()).resolves.toEqual({
      lineRequestId: 'line-request-1',
      ok: true,
    })
  })
})
