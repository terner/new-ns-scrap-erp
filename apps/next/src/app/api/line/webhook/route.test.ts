import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  acquireReadLock: vi.fn(),
  enqueueNotificationJob: vi.fn(),
  executeNotificationJob: vi.fn(),
  fetch: vi.fn(),
  findCommandPermission: vi.fn(),
  findSetting: vi.fn(),
  transaction: vi.fn(),
  targetUpdateMany: vi.fn(),
  targetUpsert: vi.fn(),
}))

vi.mock('@/lib/server/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    system_settings: { findUnique: mocks.findSetting },
    line_targets: {
      updateMany: mocks.targetUpdateMany,
      upsert: mocks.targetUpsert,
    },
  },
}))

vi.mock('@/lib/server/line-credential-lock', () => ({
  acquireLineCredentialReadLock: mocks.acquireReadLock,
}))

vi.mock('@/lib/weight-tickets', () => ({ formatWeight: (value: number) => String(value) }))
vi.mock('@/lib/server/line-notification-jobs', () => ({
  enqueueNotificationJob: mocks.enqueueNotificationJob,
  executeNotificationJob: mocks.executeNotificationJob,
}))

import { POST } from './route'

const secret = 'super-secret-channel-key'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function signedRequest(payload: unknown, signature?: string) {
  const body = JSON.stringify(payload)
  return new Request('https://ns-erp.vercel.app/api/line/webhook', {
    body,
    headers: {
      'content-type': 'application/json',
      'x-line-signature': signature ?? createHmac('sha256', secret).update(body).digest('base64'),
    },
    method: 'POST',
  })
}

describe('POST /api/line/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mocks.fetch)
    mocks.findSetting.mockImplementation(({ where }: { where: { key: string } }) => Promise.resolve({
      value: where.key === 'LINE_CHANNEL_SECRET' ? secret : 'working-access-token',
    }))
    mocks.fetch.mockResolvedValue(Response.json({ groupName: 'กลุ่มใหม่' }))
    mocks.targetUpsert.mockResolvedValue({})
    mocks.findCommandPermission.mockResolvedValue({ is_allowed: true })
    mocks.enqueueNotificationJob.mockResolvedValue({ jobs: [{ id: '7' }], status: 'enqueued' })
    mocks.executeNotificationJob.mockResolvedValue({ pdfUrl: 'https://example.test/ticket.pdf', status: 'sent' })
    mocks.transaction.mockImplementation((callback: (transaction: unknown) => unknown) => callback({
      line_command_permissions: { findFirst: mocks.findCommandPermission },
      system_settings: { findUnique: mocks.findSetting },
      line_targets: {
        updateMany: mocks.targetUpdateMany,
        upsert: mocks.targetUpsert,
      },
    }))
  })

  it('never logs the secret, signature, or generated digest when signature verification fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const payload = { events: [] }
    const rawBody = JSON.stringify(payload)
    const digest = createHmac('sha256', secret).update(rawBody).digest('base64')
    const receivedSignature = 'invalid-signature-value'

    const response = await POST(signedRequest(payload, receivedSignature))

    expect(response.status).toBe(401)
    const logged = errorSpy.mock.calls.flatMap((call) => call.map((value) => (
      typeof value === 'string' ? value : JSON.stringify(value)
    ))).join(' ')
    expect(logged).not.toContain(secret)
    expect(logged).not.toContain(secret.slice(0, 4))
    expect(logged).not.toContain(receivedSignature)
    expect(logged).not.toContain(digest)
  })

  it('returns a retryable server error when a discovered group cannot be persisted', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.targetUpsert.mockRejectedValue(new Error('database unavailable'))

    const response = await POST(signedRequest({
      events: [{
        message: { text: 'ลงทะเบียนกลุ่ม', type: 'text' },
        source: { groupId: 'C-new-group', type: 'group', userId: 'U-member' },
        type: 'message',
      }],
    }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ code: 'WEBHOOK_PROCESSING_FAILED' })
  })

  it('accepts a correctly signed empty event used for endpoint verification', async () => {
    const response = await POST(signedRequest({ events: [] }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(mocks.acquireReadLock).toHaveBeenCalledTimes(1)
  })

  it('does not activate a target when the current channel secret rejects the old webhook', async () => {
    const oldSecret = 'old-secret'
    let releaseReadLock: (() => void) | undefined
    mocks.acquireReadLock.mockImplementationOnce(() => new Promise<void>((resolve) => {
      releaseReadLock = resolve
    }))
    const payload = {
      events: [{
        message: { text: 'hello', type: 'text' },
        source: { groupId: 'C-old-group', type: 'group', userId: 'U-member' },
        type: 'message',
      }],
    }
    const body = JSON.stringify(payload)
    mocks.findSetting.mockImplementation(({ where }: { where: { key: string } }) => Promise.resolve({
      value: where.key === 'LINE_CHANNEL_SECRET' ? secret : 'new-access-token',
    }))

    const responsePromise = POST(new Request('https://ns-erp.vercel.app/api/line/webhook', {
      body,
      headers: {
        'content-type': 'application/json',
        'x-line-signature': createHmac('sha256', oldSecret).update(body).digest('base64'),
      },
      method: 'POST',
    }))

    await vi.waitFor(() => expect(mocks.acquireReadLock).toHaveBeenCalledTimes(1))
    expect(mocks.findSetting).not.toHaveBeenCalled()
    expect(mocks.targetUpsert).not.toHaveBeenCalled()

    releaseReadLock?.()
    const response = await responsePromise

    expect(response.status).toBe(401)
    expect(mocks.targetUpsert).not.toHaveBeenCalled()
  })

  it('reuses the webhook credential lock for retry enqueue and execution', async () => {
    const response = await POST(signedRequest({
      events: [{
        message: { text: '/retry PMT012607-0001', type: 'text' },
        replyToken: 'reply-token',
        source: { groupId: 'C-current-group', type: 'group', userId: 'U-member' },
        type: 'message',
      }],
    }))

    expect(response.status).toBe(200)
    expect(mocks.enqueueNotificationJob).toHaveBeenCalledWith('PMT012607-0001', {
      credentialLockHeld: true,
      force: true,
      requestedBy: 'line_bot_U-member',
      targetId: 'C-current-group',
    })
    expect(mocks.executeNotificationJob).toHaveBeenCalledWith('7', {
      credentialLockHeld: true,
      force: true,
    })
  })
})
