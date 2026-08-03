import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  currentActor: vi.fn(() => 'tester@example.com'),
  deriveLineWebhookEndpoint: vi.fn(() => 'https://ns-erp.vercel.app/api/line/webhook'),
  fetchLineBotInfo: vi.fn(),
  getLineWebhookEndpointInfo: vi.fn(),
  getCurrentAuthContext: vi.fn(),
  jobUpdateMany: vi.fn(),
  requirePermission: vi.fn(),
  settingFindMany: vi.fn(),
  settingFindUnique: vi.fn(),
  settingUpsert: vi.fn(),
  syncLineTargetsFromAPI: vi.fn(),
  setLineWebhookEndpoint: vi.fn(),
  targetUpdateMany: vi.fn(),
  testLineWebhookEndpoint: vi.fn(),
  transaction: vi.fn(),
  verifyLineCredentialPair: vi.fn(),
  writeCredentialLock: vi.fn(),
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

vi.mock('@/lib/server/daily', () => ({ currentActor: mocks.currentActor }))

vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    line_notification_jobs: { updateMany: mocks.jobUpdateMany },
    line_targets: { updateMany: mocks.targetUpdateMany },
    system_settings: {
      findMany: mocks.settingFindMany,
      findUnique: mocks.settingFindUnique,
      upsert: mocks.settingUpsert,
    },
  },
}))

vi.mock('@/lib/server/line-target-sync', () => ({
  fetchLineBotInfo: mocks.fetchLineBotInfo,
  isMaskedToken: (value: string | null | undefined) => Boolean(value?.includes('••')),
  syncLineTargetsFromAPI: mocks.syncLineTargetsFromAPI,
}))

vi.mock('@/lib/server/line-webhook-settings', () => ({
  deriveLineWebhookEndpoint: mocks.deriveLineWebhookEndpoint,
  getLineWebhookEndpointInfo: mocks.getLineWebhookEndpointInfo,
  setLineWebhookEndpoint: mocks.setLineWebhookEndpoint,
  testLineWebhookEndpoint: mocks.testLineWebhookEndpoint,
  verifyLineCredentialPair: mocks.verifyLineCredentialPair,
}))

vi.mock('@/lib/server/line-credential-lock', () => ({
  acquireLineCredentialWriteLock: mocks.writeCredentialLock,
}))

import { POST } from './route'

function request(overrides: Record<string, unknown> = {}, url = 'http://localhost/api/admin/line-settings') {
  return new Request(url, {
    body: JSON.stringify({
      appUrl: 'https://ns-erp.vercel.app',
      googleSheetsWebhookUrl: '',
      lineAlbumQuality: 90,
      lineAlbumShowBadges: true,
      lineAlbumShowTimestamps: true,
      lineAutoSendWti: false,
      lineAutoSendWto: false,
      lineChannelAccessToken: 'new-token',
      lineChannelSecret: 'new-secret',
      lineDefaultTargetId: '',
      lineNotifyTextTemplateWti: '',
      lineNotifyTextTemplateWto: '',
      pdfBucket: 'weight-ticket-pdfs',
      ...overrides,
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
}

describe('POST /api/admin/line-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.deriveLineWebhookEndpoint.mockReturnValue('https://ns-erp.vercel.app/api/line/webhook')
    mocks.getCurrentAuthContext.mockResolvedValue({ appUser: { email: 'tester@example.com' } })
    mocks.settingFindUnique.mockResolvedValue({ value: 'working-token' })
    mocks.settingFindMany.mockResolvedValue([
      { key: 'LINE_CHANNEL_ACCESS_TOKEN', value: 'working-token' },
      { key: 'LINE_CHANNEL_SECRET', value: 'working-secret' },
      { key: 'NEXT_PUBLIC_APP_URL', value: 'https://old.ns-erp.vercel.app' },
      { key: 'LINE_DEFAULT_TARGET_ID', value: 'old-default' },
    ])
    mocks.settingUpsert.mockResolvedValue({})
    mocks.jobUpdateMany.mockResolvedValue({ count: 0 })
    mocks.targetUpdateMany.mockResolvedValue({ count: 0 })
    mocks.transaction.mockImplementation(async (operation: unknown) => {
      if (typeof operation !== 'function') return []
      return (operation as (transaction: {
        line_notification_jobs: { updateMany: typeof mocks.jobUpdateMany }
        line_targets: { updateMany: typeof mocks.targetUpdateMany }
        system_settings: {
          findMany: typeof mocks.settingFindMany
          upsert: typeof mocks.settingUpsert
        }
      }) => unknown)({
        line_notification_jobs: { updateMany: mocks.jobUpdateMany },
        line_targets: { updateMany: mocks.targetUpdateMany },
        system_settings: {
          findMany: mocks.settingFindMany,
          upsert: mocks.settingUpsert,
        },
      })
    })
    mocks.syncLineTargetsFromAPI.mockResolvedValue({})
    mocks.setLineWebhookEndpoint.mockResolvedValue(undefined)
    mocks.getLineWebhookEndpointInfo.mockResolvedValue({
      active: false,
      endpoint: 'https://ns-erp.vercel.app/api/line/webhook',
    })
    mocks.testLineWebhookEndpoint.mockResolvedValue({
      detail: '',
      reason: 'OK',
      statusCode: 200,
      success: true,
    })
    mocks.verifyLineCredentialPair.mockResolvedValue(undefined)
    mocks.writeCredentialLock.mockResolvedValue(undefined)
  })

  it('keeps the working credentials untouched when LINE rejects a submitted token', async () => {
    mocks.fetchLineBotInfo.mockRejectedValue(new Error('LINE Channel Access Token ใช้งานไม่ได้ (401)'))

    const response = await POST(request())

    expect(response.status).toBe(400)
    expect(mocks.fetchLineBotInfo).toHaveBeenCalledWith('new-token')
    expect(mocks.settingUpsert).not.toHaveBeenCalled()
    expect(mocks.targetUpdateMany).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.syncLineTargetsFromAPI).not.toHaveBeenCalled()
  })

  it('parks existing targets before syncing a different valid token', async () => {
    mocks.fetchLineBotInfo.mockResolvedValue({ botName: 'New OA', basicId: '@newoa', pictureUrl: null })

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(mocks.settingFindMany).toHaveBeenCalledWith({
      where: { key: { in: expect.arrayContaining(['LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CHANNEL_SECRET']) } },
    })
    expect(mocks.targetUpdateMany).toHaveBeenCalledWith({
      data: {
        is_active: false,
        is_default: false,
        last_event_type: 'credentials_changed',
        updated_at: expect.any(Date),
      },
    })
    expect(mocks.jobUpdateMany).toHaveBeenCalledWith({
      where: { status: { in: ['pending', 'processing', 'failed'] } },
      data: expect.objectContaining({
        last_error_code: 'TARGET_INACTIVE',
        locked_at: null,
        locked_by: null,
        status: 'skipped',
      }),
    })
    expect(mocks.jobUpdateMany.mock.calls[0]?.[0]?.data).not.toHaveProperty('attempt_count')
    expect(mocks.writeCredentialLock).toHaveBeenCalledOnce()
    expect(mocks.writeCredentialLock.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.targetUpdateMany.mock.invocationCallOrder[0]!
    )
    expect(mocks.transaction).toHaveBeenCalledOnce()
    expect(mocks.syncLineTargetsFromAPI).toHaveBeenCalledWith('new-token')
    expect(mocks.deriveLineWebhookEndpoint).toHaveBeenCalledWith('https://ns-erp.vercel.app')
    expect(mocks.setLineWebhookEndpoint).toHaveBeenCalledWith(
      'new-token',
      'https://ns-erp.vercel.app/api/line/webhook',
    )

    await expect(response.json()).resolves.toMatchObject({
      lineWebhook: {
        active: false,
        expectedEndpoint: 'https://ns-erp.vercel.app/api/line/webhook',
        matchesExpected: true,
        ready: false,
        test: { success: true },
      },
    })
  })

  it('requires the matching channel secret when switching to a different OA token', async () => {
    mocks.fetchLineBotInfo.mockResolvedValue({ botName: 'New OA', basicId: '@newoa', pictureUrl: null })

    const response = await POST(request({ lineChannelSecret: '••••••••••••••••' }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Channel Secret'),
    })
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.targetUpdateMany).not.toHaveBeenCalled()
    expect(mocks.syncLineTargetsFromAPI).not.toHaveBeenCalled()
  })

  it('keeps working credentials and targets when the secret belongs to another LINE OA', async () => {
    mocks.fetchLineBotInfo.mockResolvedValue({ botName: 'New OA', basicId: '@newoa', pictureUrl: null })
    mocks.verifyLineCredentialPair.mockRejectedValue(
      new Error('Channel Access Token และ Channel Secret ไม่ใช่ของ LINE OA เดียวกัน')
    )

    const response = await POST(request())

    expect(response.status).toBe(400)
    expect(mocks.verifyLineCredentialPair).toHaveBeenCalledWith('new-token', 'new-secret')
    expect(mocks.setLineWebhookEndpoint).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.targetUpdateMany).not.toHaveBeenCalled()
    expect(mocks.syncLineTargetsFromAPI).not.toHaveBeenCalled()
  })

  it('rejects a secret-only mismatch without changing a working LINE OA', async () => {
    mocks.fetchLineBotInfo.mockResolvedValue({ botName: 'Current OA', basicId: '@current', pictureUrl: null })
    mocks.verifyLineCredentialPair.mockRejectedValue(new Error('raw LINE diagnostic must not escape'))

    const response = await POST(request({
      lineChannelAccessToken: '••••••••••••••••',
      lineChannelSecret: 'other-secret',
    }))

    expect(response.status).toBe(400)
    expect(mocks.fetchLineBotInfo).toHaveBeenCalledWith('working-token')
    expect(mocks.verifyLineCredentialPair).toHaveBeenCalledWith('working-token', 'other-secret')
    expect(mocks.setLineWebhookEndpoint).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.syncLineTargetsFromAPI).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      error: expect.not.stringContaining('raw LINE diagnostic'),
    })
  })

  it('uses stored credentials to update the exact webhook endpoint after an app URL-only change', async () => {
    mocks.fetchLineBotInfo.mockResolvedValue({ botName: 'Current OA', basicId: '@current', pictureUrl: null })
    mocks.deriveLineWebhookEndpoint.mockReturnValue('https://new.ns-erp.vercel.app/api/line/webhook')
    mocks.getLineWebhookEndpointInfo.mockResolvedValue({
      active: true,
      endpoint: 'https://new.ns-erp.vercel.app/api/line/webhook',
    })

    const response = await POST(request({
      appUrl: 'https://new.ns-erp.vercel.app',
      lineChannelAccessToken: '••••••••••••••••',
      lineChannelSecret: '••••••••••••••••',
    }))

    expect(response.status).toBe(200)
    expect(mocks.fetchLineBotInfo).not.toHaveBeenCalled()
    expect(mocks.verifyLineCredentialPair).not.toHaveBeenCalled()
    expect(mocks.setLineWebhookEndpoint).toHaveBeenCalledWith(
      'working-token',
      'https://new.ns-erp.vercel.app/api/line/webhook',
    )
    expect(mocks.getLineWebhookEndpointInfo).toHaveBeenCalledWith('working-token')
    expect(mocks.testLineWebhookEndpoint).toHaveBeenCalledWith(
      'working-token',
      'https://new.ns-erp.vercel.app/api/line/webhook',
    )
    expect(mocks.syncLineTargetsFromAPI).not.toHaveBeenCalled()
  })

  it('uses the current HTTPS app origin instead of a stale saved public URL', async () => {
    const response = await POST(request({
      appUrl: 'https://ns-dev.devkub.com',
      lineChannelAccessToken: '••••••••••••••••',
      lineChannelSecret: '••••••••••••••••',
    }, 'https://ns-erp.vercel.app/api/admin/line-settings'))

    expect(response.status).toBe(200)
    expect(mocks.deriveLineWebhookEndpoint).toHaveBeenCalledWith('https://ns-erp.vercel.app')
    expect(mocks.setLineWebhookEndpoint).toHaveBeenCalledWith(
      'working-token',
      'https://ns-erp.vercel.app/api/line/webhook',
    )
  })

  it('aborts safely when credentials changed after preflight but before the locked write', async () => {
    mocks.fetchLineBotInfo.mockResolvedValue({ botName: 'New OA', basicId: '@new', pictureUrl: null })
    mocks.settingFindMany
      .mockResolvedValueOnce([
        { key: 'LINE_CHANNEL_ACCESS_TOKEN', value: 'working-token' },
        { key: 'LINE_CHANNEL_SECRET', value: 'working-secret' },
        { key: 'NEXT_PUBLIC_APP_URL', value: 'https://old.ns-erp.vercel.app' },
      ])
      .mockResolvedValueOnce([
        { key: 'LINE_CHANNEL_ACCESS_TOKEN', value: 'concurrently-changed-token' },
        { key: 'LINE_CHANNEL_SECRET', value: 'working-secret' },
        { key: 'NEXT_PUBLIC_APP_URL', value: 'https://old.ns-erp.vercel.app' },
      ])

    const response = await POST(request())

    expect(response.status).toBe(400)
    expect(mocks.writeCredentialLock).toHaveBeenCalledOnce()
    expect(mocks.getLineWebhookEndpointInfo).not.toHaveBeenCalled()
    expect(mocks.setLineWebhookEndpoint).not.toHaveBeenCalled()
    expect(mocks.targetUpdateMany).not.toHaveBeenCalled()
    expect(mocks.settingUpsert).not.toHaveBeenCalled()
    expect(mocks.syncLineTargetsFromAPI).not.toHaveBeenCalled()
  })

  it('restores the captured remote endpoint when a token-switch DB write fails', async () => {
    mocks.fetchLineBotInfo.mockResolvedValue({ botName: 'New OA', basicId: '@new', pictureUrl: null })
    mocks.getLineWebhookEndpointInfo.mockResolvedValue({
      active: true,
      endpoint: 'https://legacy.example.com/custom-hook',
    })
    mocks.settingUpsert.mockRejectedValueOnce(new Error('raw database failure'))

    const response = await POST(request())

    expect(response.status).toBe(400)
    expect(mocks.getLineWebhookEndpointInfo).toHaveBeenCalledWith('new-token')
    expect(mocks.setLineWebhookEndpoint).toHaveBeenNthCalledWith(
      1,
      'new-token',
      'https://ns-erp.vercel.app/api/line/webhook',
    )
    expect(mocks.setLineWebhookEndpoint).toHaveBeenNthCalledWith(
      2,
      'new-token',
      'https://legacy.example.com/custom-hook',
    )
    expect(mocks.getLineWebhookEndpointInfo.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.setLineWebhookEndpoint.mock.invocationCallOrder[0]!,
    )
    expect(mocks.setLineWebhookEndpoint.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.settingUpsert.mock.invocationCallOrder[0]!,
    )
    expect(mocks.settingUpsert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.setLineWebhookEndpoint.mock.invocationCallOrder[1]!,
    )
    expect(mocks.syncLineTargetsFromAPI).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({
      error: expect.not.stringContaining('raw database failure'),
    })
  })

  it('does not let a stale app-URL writer mutate or restore over the serialized winner', async () => {
    mocks.settingFindMany
      .mockResolvedValueOnce([
        { key: 'LINE_CHANNEL_ACCESS_TOKEN', value: 'working-token' },
        { key: 'LINE_CHANNEL_SECRET', value: 'working-secret' },
        { key: 'NEXT_PUBLIC_APP_URL', value: 'https://old.ns-erp.vercel.app' },
      ])
      .mockResolvedValueOnce([
        { key: 'LINE_CHANNEL_ACCESS_TOKEN', value: 'working-token' },
        { key: 'LINE_CHANNEL_SECRET', value: 'working-secret' },
        { key: 'NEXT_PUBLIC_APP_URL', value: 'https://winner.ns-erp.vercel.app' },
      ])

    const response = await POST(request({
      appUrl: 'https://loser.ns-erp.vercel.app',
      lineChannelAccessToken: '••••••••••••••••',
      lineChannelSecret: '••••••••••••••••',
    }))

    expect(response.status).toBe(400)
    expect(mocks.writeCredentialLock).toHaveBeenCalledOnce()
    expect(mocks.getLineWebhookEndpointInfo).not.toHaveBeenCalled()
    expect(mocks.setLineWebhookEndpoint).not.toHaveBeenCalled()
    expect(mocks.settingUpsert).not.toHaveBeenCalled()
  })

  it('clears the old default target while parking targets for an OA token switch', async () => {
    mocks.fetchLineBotInfo.mockResolvedValue({ botName: 'New OA', basicId: '@new', pictureUrl: null })

    const response = await POST(request({ lineDefaultTargetId: 'must-not-survive' }))

    expect(response.status).toBe(200)
    expect(mocks.targetUpdateMany).toHaveBeenCalledWith({
      data: expect.objectContaining({ is_active: false, is_default: false }),
    })
    expect(mocks.settingUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: 'LINE_DEFAULT_TARGET_ID' },
      update: expect.objectContaining({ value: null }),
    }))
  })

  it('does not replace working settings when LINE rejects webhook configuration', async () => {
    mocks.fetchLineBotInfo.mockResolvedValue({ botName: 'New OA', basicId: '@newoa', pictureUrl: null })
    mocks.setLineWebhookEndpoint.mockRejectedValue(new Error('LINE webhook API request failed (400)'))

    const response = await POST(request())

    expect(response.status).toBe(400)
    expect(mocks.transaction).toHaveBeenCalledOnce()
    expect(mocks.getLineWebhookEndpointInfo).toHaveBeenCalledWith('new-token')
    expect(mocks.targetUpdateMany).not.toHaveBeenCalled()
    expect(mocks.syncLineTargetsFromAPI).not.toHaveBeenCalled()
  })

  it('does not claim the Use webhook step is reached when the endpoint test is unavailable', async () => {
    mocks.fetchLineBotInfo.mockResolvedValue({ botName: 'New OA', basicId: '@newoa', pictureUrl: null })
    mocks.testLineWebhookEndpoint.mockRejectedValue(new Error('Unable to reach LINE webhook API'))

    const response = await POST(request())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      lineWebhook: {
        ready: false,
        status: 'verification_unavailable',
        test: null,
      },
      webhookWarning: expect.stringContaining('ทดสอบ Webhook'),
    })
  })
})
