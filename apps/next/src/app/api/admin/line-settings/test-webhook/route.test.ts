import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  acquireWriteLock: vi.fn(),
  deriveLineWebhookEndpoint: vi.fn(),
  findSettings: vi.fn(),
  getCurrentAuthContext: vi.fn(),
  getLineWebhookEndpointInfo: vi.fn(),
  requirePermission: vi.fn(),
  setLineWebhookEndpoint: vi.fn(),
  testLineWebhookEndpoint: vi.fn(),
  transaction: vi.fn(),
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
    system_settings: { findMany: mocks.findSettings },
  },
}))

vi.mock('@/lib/server/line-credential-lock', () => ({
  acquireLineCredentialWriteLock: mocks.acquireWriteLock,
}))

vi.mock('@/lib/server/line-webhook-settings', () => ({
  deriveLineWebhookEndpoint: mocks.deriveLineWebhookEndpoint,
  getLineWebhookEndpointInfo: mocks.getLineWebhookEndpointInfo,
  setLineWebhookEndpoint: mocks.setLineWebhookEndpoint,
  testLineWebhookEndpoint: mocks.testLineWebhookEndpoint,
}))

import { POST } from './route'

const endpoint = 'https://ns-erp.vercel.app/api/line/webhook'

describe('POST /api/admin/line-settings/test-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentAuthContext.mockResolvedValue({ appUser: { email: 'tester@example.com' } })
    mocks.acquireWriteLock.mockResolvedValue(undefined)
    mocks.transaction.mockImplementation((callback: (transaction: unknown) => unknown) => callback({
      system_settings: { findMany: mocks.findSettings },
    }))
    mocks.findSettings.mockResolvedValue([
      { key: 'LINE_CHANNEL_ACCESS_TOKEN', value: 'working-token' },
      { key: 'NEXT_PUBLIC_APP_URL', value: 'https://ns-erp.vercel.app' },
    ])
    mocks.deriveLineWebhookEndpoint.mockReturnValue(endpoint)
    mocks.setLineWebhookEndpoint.mockResolvedValue(undefined)
    mocks.getLineWebhookEndpointInfo.mockResolvedValue({ active: false, endpoint })
    mocks.testLineWebhookEndpoint.mockResolvedValue({
      detail: '',
      reason: 'OK',
      statusCode: 200,
      success: true,
    })
  })

  it('sets and tests the exact public endpoint without reading or returning the channel secret', async () => {
    const response = await POST(new Request('https://ns-erp.vercel.app/api/admin/line-settings/test-webhook', {
      method: 'POST',
    }))

    expect(response.status).toBe(200)
    expect(mocks.findSettings).toHaveBeenCalledWith({
      where: { key: { in: ['LINE_CHANNEL_ACCESS_TOKEN', 'NEXT_PUBLIC_APP_URL'] } },
    })
    expect(mocks.deriveLineWebhookEndpoint).toHaveBeenCalledWith('https://ns-erp.vercel.app')
    expect(mocks.setLineWebhookEndpoint).toHaveBeenCalledWith('working-token', endpoint)
    expect(mocks.getLineWebhookEndpointInfo).toHaveBeenCalledWith('working-token')
    expect(mocks.testLineWebhookEndpoint).toHaveBeenCalledWith('working-token', endpoint)

    const body = await response.json()
    expect(body).toMatchObject({
      active: false,
      endpoint,
      expectedEndpoint: endpoint,
      matchesExpected: true,
      ok: true,
      ready: false,
      status: 'use_webhook_disabled',
      test: { success: true },
    })
    expect(body.message).toContain('Use webhook')
    expect(body).not.toHaveProperty('secretPrefix')
    expect(body).not.toHaveProperty('response')
  })

  it('waits for the credential write lock before reading current settings or calling LINE', async () => {
    let releaseLock!: () => void
    mocks.acquireWriteLock.mockImplementation(() => new Promise<void>((resolve) => {
      releaseLock = resolve
    }))
    mocks.findSettings.mockResolvedValue([
      { key: 'LINE_CHANNEL_ACCESS_TOKEN', value: 'locked-current-token' },
      { key: 'NEXT_PUBLIC_APP_URL', value: 'https://locked-current.example' },
    ])
    mocks.deriveLineWebhookEndpoint.mockReturnValue(
      'https://locked-current.example/api/line/webhook',
    )

    const responsePromise = POST(new Request(
      'https://stale-request.example/api/admin/line-settings/test-webhook',
      { method: 'POST' },
    ))

    await vi.waitFor(() => expect(mocks.acquireWriteLock).toHaveBeenCalledTimes(1))
    expect(mocks.findSettings).not.toHaveBeenCalled()
    expect(mocks.setLineWebhookEndpoint).not.toHaveBeenCalled()
    expect(mocks.getLineWebhookEndpointInfo).not.toHaveBeenCalled()
    expect(mocks.testLineWebhookEndpoint).not.toHaveBeenCalled()

    releaseLock()
    const response = await responsePromise

    expect(response.status).toBe(200)
    expect(mocks.deriveLineWebhookEndpoint).toHaveBeenCalledWith('https://locked-current.example')
    expect(mocks.setLineWebhookEndpoint).toHaveBeenCalledWith(
      'locked-current-token',
      'https://locked-current.example/api/line/webhook',
    )
    expect(mocks.getLineWebhookEndpointInfo).toHaveBeenCalledWith('locked-current-token')
    expect(mocks.testLineWebhookEndpoint).toHaveBeenCalledWith(
      'locked-current-token',
      'https://locked-current.example/api/line/webhook',
    )
  })

  it('uses LINE test success instead of HTTP 200 alone', async () => {
    mocks.testLineWebhookEndpoint.mockResolvedValue({
      detail: 'Endpoint returned HTTP 401',
      reason: 'ERROR_STATUS_CODE',
      statusCode: 401,
      success: false,
    })

    const response = await POST(new Request('https://ns-erp.vercel.app/api/admin/line-settings/test-webhook', {
      method: 'POST',
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      ready: false,
      status: 'test_failed',
      test: { statusCode: 401, success: false },
    })
  })

  it('still reports the endpoint test when LINE endpoint-info cache is not ready yet', async () => {
    mocks.getLineWebhookEndpointInfo.mockRejectedValue(new Error('LINE webhook API request failed (404)'))

    const response = await POST(new Request('https://ns-erp.vercel.app/api/admin/line-settings/test-webhook', {
      method: 'POST',
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      active: null,
      endpoint: null,
      expectedEndpoint: endpoint,
      matchesExpected: null,
      ok: true,
      ready: false,
      status: 'verification_unavailable',
      test: { success: true },
      warning: expect.stringContaining('404'),
    })
  })
})
