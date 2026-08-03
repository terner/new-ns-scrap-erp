import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  deriveLineWebhookEndpoint,
  getLineWebhookEndpointInfo,
  setLineWebhookEndpoint,
  testLineWebhookEndpoint,
  verifyLineCredentialPair,
} from './line-webhook-settings'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LINE webhook settings', () => {
  it('verifies that the access token and channel secret belong to the same LINE channel', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ client_id: '1234567890' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      verifyLineCredentialPair('test-channel-access-token', 'matching-channel-secret')
    ).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://api.line.me/v2/oauth/verify', {
      body: new URLSearchParams({ access_token: 'test-channel-access-token' }),
      cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://api.line.me/oauth2/v3/token', {
      body: new URLSearchParams({
        client_id: '1234567890',
        client_secret: 'matching-channel-secret',
        grant_type: 'client_credentials',
      }),
      cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
  })

  it('rejects a channel secret from another LINE channel without exposing the response body', async () => {
    const secret = 'do-not-leak-this-secret'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ client_id: '1234567890' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(`wrong secret: ${secret}`, { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)

    const error = await verifyLineCredentialPair('test-channel-access-token', secret).then(
      () => null,
      (cause: unknown) => cause,
    )

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe(
      'Channel Access Token และ Channel Secret ไม่ใช่ของ LINE OA เดียวกัน'
    )
    expect((error as Error).message).not.toContain(secret)
  })

  it('supports a valid Channel Access Token v2.1 when resolving its channel ID', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ client_id: '9876543210' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      verifyLineCredentialPair('v2.1-channel-access-token', 'matching-channel-secret')
    ).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.line.me/oauth2/v2.1/verify?access_token=v2.1-channel-access-token',
      {
        cache: 'no-store',
        method: 'GET',
      },
    )
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'https://api.line.me/oauth2/v3/token', {
      body: new URLSearchParams({
        client_id: '9876543210',
        client_secret: 'matching-channel-secret',
        grant_type: 'client_credentials',
      }),
      cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
  })

  it('derives the canonical webhook endpoint from an explicit application URL', () => {
    expect(deriveLineWebhookEndpoint('https://ns-erp.vercel.app/')).toBe(
      'https://ns-erp.vercel.app/api/line/webhook'
    )
  })

  it('rejects a webhook endpoint that does not use HTTPS', () => {
    expect(() => deriveLineWebhookEndpoint('http://ns-erp.vercel.app')).toThrow(
      'LINE webhook endpoint must use HTTPS'
    )
  })

  it('rejects a webhook endpoint longer than 500 characters', () => {
    const longHostname = Array.from({ length: 9 }, () => 'a'.repeat(55)).join('.')

    expect(() => deriveLineWebhookEndpoint(`https://${longHostname}`)).toThrow(
      'LINE webhook endpoint must be 500 characters or fewer'
    )
  })

  it('sets the webhook endpoint through the official LINE Messaging API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      setLineWebhookEndpoint(
        'test-channel-access-token',
        'https://ns-erp.vercel.app/api/line/webhook'
      )
    ).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.line.me/v2/bot/channel/webhook/endpoint',
      {
        body: JSON.stringify({
          endpoint: 'https://ns-erp.vercel.app/api/line/webhook',
        }),
        cache: 'no-store',
        headers: {
          Authorization: 'Bearer test-channel-access-token',
          'Content-Type': 'application/json',
        },
        method: 'PUT',
      }
    )
  })

  it('can restore a previously configured HTTPS endpoint with a custom path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      setLineWebhookEndpoint(
        'test-channel-access-token',
        'https://legacy.example.com/custom-hook'
      )
    ).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.line.me/v2/bot/channel/webhook/endpoint',
      expect.objectContaining({
        body: JSON.stringify({ endpoint: 'https://legacy.example.com/custom-hook' }),
        method: 'PUT',
      })
    )
  })

  it('gets the configured endpoint and Use webhook status', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          active: false,
          endpoint: 'https://ns-erp.vercel.app/api/line/webhook',
          ignored: 'not part of the public result',
        }),
        { status: 200 }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      getLineWebhookEndpointInfo('test-channel-access-token')
    ).resolves.toEqual({
      active: false,
      endpoint: 'https://ns-erp.vercel.app/api/line/webhook',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.line.me/v2/bot/channel/webhook/endpoint',
      {
        cache: 'no-store',
        headers: {
          Authorization: 'Bearer test-channel-access-token',
          'Content-Type': 'application/json',
        },
        method: 'GET',
      }
    )
  })

  it('uses the LINE test result success field and returns only safe diagnostics', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: 'TLS handshake failure',
          ignored: 'must not escape the helper',
          reason: 'COULD_NOT_CONNECT',
          statusCode: 0,
          success: false,
        }),
        { status: 200 }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      testLineWebhookEndpoint(
        'test-channel-access-token',
        'https://ns-erp.vercel.app/api/line/webhook'
      )
    ).resolves.toEqual({
      detail: 'TLS handshake failure',
      reason: 'COULD_NOT_CONNECT',
      statusCode: 0,
      success: false,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.line.me/v2/bot/channel/webhook/test',
      {
        body: JSON.stringify({
          endpoint: 'https://ns-erp.vercel.app/api/line/webhook',
        }),
        cache: 'no-store',
        headers: {
          Authorization: 'Bearer test-channel-access-token',
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }
    )
  })

  it.each([
    {
      call: (token: string) =>
        setLineWebhookEndpoint(
          token,
          'https://ns-erp.vercel.app/api/line/webhook'
        ),
      operation: 'set',
    },
    {
      call: (token: string) => getLineWebhookEndpointInfo(token),
      operation: 'get',
    },
    {
      call: (token: string) =>
        testLineWebhookEndpoint(
          token,
          'https://ns-erp.vercel.app/api/line/webhook'
        ),
      operation: 'test',
    },
  ])(
    'normalizes $operation network failures without leaking credentials',
    async ({ call }) => {
      const token = 'do-not-leak-this-token'
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(
          new Error(`network failed with Authorization: Bearer ${token}`)
        )
      )

      const error = await call(token).then(
        () => null,
        (cause: unknown) => cause
      )

      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('Unable to reach LINE webhook API')
      expect((error as Error).message).not.toContain(token)
      expect((error as Error).message).not.toContain('Authorization')
    }
  )

  it.each([
    {
      call: (token: string) => getLineWebhookEndpointInfo(token),
      operation: 'get',
    },
    {
      call: (token: string) =>
        testLineWebhookEndpoint(
          token,
          'https://ns-erp.vercel.app/api/line/webhook'
        ),
      operation: 'test',
    },
  ])('normalizes an invalid $operation response body', async ({ call }) => {
    const token = 'do-not-leak-this-token'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(`{"Authorization":"Bearer ${token}"`, { status: 200 })
      )
    )

    const error = await call(token).then(
      () => null,
      (cause: unknown) => cause
    )

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe(
      'LINE webhook API returned an invalid response'
    )
    expect((error as Error).message).not.toContain(token)
    expect((error as Error).message).not.toContain('Authorization')
  })

  it('does not include LINE error bodies or request headers in HTTP failures', async () => {
    const token = 'do-not-leak-this-token'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ message: `Authorization: Bearer ${token}` }),
          { status: 401 }
        )
      )
    )

    const error = await setLineWebhookEndpoint(
      token,
      'https://ns-erp.vercel.app/api/line/webhook'
    ).then(
      () => null,
      (cause: unknown) => cause
    )

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe(
      'LINE webhook API request failed (401)'
    )
    expect((error as Error).message).not.toContain(token)
    expect((error as Error).message).not.toContain('Authorization')
  })
})
