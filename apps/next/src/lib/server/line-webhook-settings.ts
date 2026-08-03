const LINE_WEBHOOK_PATH = '/api/line/webhook'
const LINE_WEBHOOK_API_URL = 'https://api.line.me/v2/bot/channel/webhook/endpoint'
const LINE_WEBHOOK_TEST_API_URL = 'https://api.line.me/v2/bot/channel/webhook/test'
const LINE_CHANNEL_TOKEN_VERIFY_API_URL = 'https://api.line.me/v2/oauth/verify'
const LINE_CHANNEL_TOKEN_V21_VERIFY_API_URL = 'https://api.line.me/oauth2/v2.1/verify'
const LINE_STATELESS_TOKEN_API_URL = 'https://api.line.me/oauth2/v3/token'

export interface LineWebhookEndpointInfo {
  endpoint: string
  active: boolean
}

export interface LineWebhookTestResult {
  success: boolean
  statusCode: number
  reason: string
  detail: string
}

async function requestLineWebhookApi(
  url: string,
  channelAccessToken: string,
  init: Pick<RequestInit, 'body' | 'method'>
): Promise<Response> {
  const token = channelAccessToken.trim()
  if (!token) {
    throw new Error('LINE Channel Access Token is required')
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
  } catch {
    throw new Error('Unable to reach LINE webhook API')
  }

  if (!response.ok) {
    throw new Error(`LINE webhook API request failed (${response.status})`)
  }

  return response
}

async function readLineWebhookResponse(
  response: Response
): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error()
    }
    return body as Record<string, unknown>
  } catch {
    throw new Error('LINE webhook API returned an invalid response')
  }
}

export async function verifyLineCredentialPair(
  channelAccessToken: string,
  channelSecret: string
): Promise<void> {
  const token = channelAccessToken.trim()
  const secret = channelSecret.trim()
  if (!token || !secret) {
    throw new Error('กรุณากรอก Channel Access Token และ Channel Secret ให้ครบ')
  }

  let verifyResponse: Response
  try {
    verifyResponse = await fetch(LINE_CHANNEL_TOKEN_VERIFY_API_URL, {
      body: new URLSearchParams({ access_token: token }),
      cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
  } catch {
    throw new Error('ไม่สามารถเชื่อมต่อ LINE เพื่อตรวจสอบ Credential ได้')
  }

  if (!verifyResponse.ok) {
    const v21VerifyUrl = new URL(LINE_CHANNEL_TOKEN_V21_VERIFY_API_URL)
    v21VerifyUrl.searchParams.set('access_token', token)
    try {
      verifyResponse = await fetch(v21VerifyUrl.toString(), {
        cache: 'no-store',
        method: 'GET',
      })
    } catch {
      throw new Error('ไม่สามารถเชื่อมต่อ LINE เพื่อตรวจสอบ Credential ได้')
    }
  }

  if (!verifyResponse.ok) {
    throw new Error(`LINE Channel Access Token ใช้งานไม่ได้ (${verifyResponse.status})`)
  }

  let clientId: string
  try {
    const body: unknown = await verifyResponse.json()
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      typeof (body as Record<string, unknown>).client_id !== 'string'
    ) {
      throw new Error()
    }
    clientId = (body as { client_id: string }).client_id
  } catch {
    throw new Error('LINE token verification returned an invalid response')
  }

  let pairResponse: Response
  try {
    pairResponse = await fetch(LINE_STATELESS_TOKEN_API_URL, {
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: secret,
        grant_type: 'client_credentials',
      }),
      cache: 'no-store',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })
  } catch {
    throw new Error('ไม่สามารถเชื่อมต่อ LINE เพื่อตรวจสอบ Credential ได้')
  }

  if (!pairResponse.ok) {
    throw new Error('Channel Access Token และ Channel Secret ไม่ใช่ของ LINE OA เดียวกัน')
  }
}

export function deriveLineWebhookEndpoint(applicationUrl: string): string {
  let endpoint: URL

  try {
    endpoint = new URL(LINE_WEBHOOK_PATH, applicationUrl)
  } catch {
    throw new Error('Invalid application URL')
  }

  if (endpoint.protocol !== 'https:') {
    throw new Error('LINE webhook endpoint must use HTTPS')
  }

  const value = endpoint.toString()
  if (value.length > 500) {
    throw new Error('LINE webhook endpoint must be 500 characters or fewer')
  }

  return value
}

export async function setLineWebhookEndpoint(
  channelAccessToken: string,
  endpoint: string
): Promise<void> {
  let parsedEndpoint: URL
  try {
    parsedEndpoint = new URL(endpoint)
  } catch {
    throw new Error('Invalid LINE webhook endpoint')
  }
  if (parsedEndpoint.protocol !== 'https:' || !parsedEndpoint.hostname) {
    throw new Error('LINE webhook endpoint must use HTTPS')
  }
  if (endpoint.length > 500) {
    throw new Error('LINE webhook endpoint must be 500 characters or fewer')
  }

  await requestLineWebhookApi(LINE_WEBHOOK_API_URL, channelAccessToken, {
    body: JSON.stringify({ endpoint }),
    method: 'PUT',
  })
}

export async function getLineWebhookEndpointInfo(
  channelAccessToken: string
): Promise<LineWebhookEndpointInfo> {
  const response = await requestLineWebhookApi(
    LINE_WEBHOOK_API_URL,
    channelAccessToken,
    {
      method: 'GET',
    }
  )

  const body = await readLineWebhookResponse(response)
  if (typeof body.endpoint !== 'string' || typeof body.active !== 'boolean') {
    throw new Error('LINE webhook API returned an invalid response')
  }

  return { endpoint: body.endpoint, active: body.active }
}

export async function testLineWebhookEndpoint(
  channelAccessToken: string,
  endpoint: string
): Promise<LineWebhookTestResult> {
  if (deriveLineWebhookEndpoint(endpoint) !== endpoint) {
    throw new Error(`LINE webhook endpoint must end with ${LINE_WEBHOOK_PATH}`)
  }

  const response = await requestLineWebhookApi(
    LINE_WEBHOOK_TEST_API_URL,
    channelAccessToken,
    {
      body: JSON.stringify({ endpoint }),
      method: 'POST',
    }
  )

  const body = await readLineWebhookResponse(response)
  if (
    typeof body.success !== 'boolean' ||
    typeof body.statusCode !== 'number' ||
    typeof body.reason !== 'string' ||
    typeof body.detail !== 'string'
  ) {
    throw new Error('LINE webhook API returned an invalid response')
  }

  return {
    success: body.success,
    statusCode: body.statusCode,
    reason: body.reason,
    detail: body.detail,
  }
}
