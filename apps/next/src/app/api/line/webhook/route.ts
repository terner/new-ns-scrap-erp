import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { recordLineWebhookEvents, resolveLineChannelSecret } from '@/lib/server/line-settings'

export const runtime = 'nodejs'

async function verifyLineSignature(rawBody: string, signature: string | null) {
  const secret = await resolveLineChannelSecret()
  if (!secret || !signature) return false
  const digest = createHmac('sha256', secret).update(rawBody).digest('base64')
  const expected = Buffer.from(digest)
  const received = Buffer.from(signature)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature')
  if (!await verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ code: 'INVALID_SIGNATURE', error: 'LINE signature ไม่ถูกต้อง' }, { status: 401 })
  }

  try {
    await recordLineWebhookEvents(JSON.parse(rawBody))
  } catch {
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
