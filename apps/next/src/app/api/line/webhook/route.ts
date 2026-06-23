import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

async function verifyLineSignature(rawBody: string, signature: string | null) {
  const config = await prisma.system_settings.findUnique({
    where: { key: 'LINE_CHANNEL_SECRET' },
  })
  const secret = config?.value || process.env.LINE_CHANNEL_SECRET || ''
  if (!secret || !signature) {
    console.error('[line-webhook] verify failed: secret or signature is missing', {
      hasSecret: !!secret,
      hasSignature: !!signature,
    })
    return false
  }
  const digest = createHmac('sha256', secret).update(rawBody).digest('base64')
  const expected = Buffer.from(digest)
  const received = Buffer.from(signature)
  const matched = expected.length === received.length && timingSafeEqual(expected, received)
  
  if (!matched) {
    console.error('[line-webhook] verify failed: signature mismatch', {
      secretLength: secret.length,
      secretPrefix: secret.slice(0, 4),
      rawBodyLength: rawBody.length,
      rawBodyPreview: rawBody.slice(0, 100),
      signature,
      digest,
    })
  } else {
    console.info('[line-webhook] verify success!')
  }
  
  return matched
}

async function upsertLineGroup(groupId: string, token: string) {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/group/${groupId}/summary`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    
    let name = `กลุ่มไลน์ ${groupId.slice(0, 6)}...`
    let pictureUrl: string | null = null

    if (res.ok) {
      const body = await res.json() as { groupName?: string; pictureUrl?: string }
      if (body.groupName) name = body.groupName
      if (body.pictureUrl) pictureUrl = body.pictureUrl
    }

    await prisma.line_groups.upsert({
      where: { group_id: groupId },
      create: {
        group_id: groupId,
        name,
        picture_url: pictureUrl,
      },
      update: {
        name,
        picture_url: pictureUrl,
        updated_at: new Date(),
      },
    })
  } catch (err) {
    console.error('[line-webhook] failed to upsert line group', err)
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature')
  if (!(await verifyLineSignature(rawBody, signature))) {
    const config = await prisma.system_settings.findUnique({
      where: { key: 'LINE_CHANNEL_SECRET' },
    })
    const secret = config?.value || process.env.LINE_CHANNEL_SECRET || ''
    const digest = createHmac('sha256', secret).update(rawBody).digest('base64')
    return NextResponse.json({ 
      code: 'INVALID_SIGNATURE', 
      error: 'LINE signature ไม่ถูกต้อง',
      debug: {
        secretLength: secret.length,
        secretPrefix: secret.slice(0, 4),
        rawBodyLength: rawBody.length,
        rawBodyPreview: rawBody.slice(0, 100),
        signature: signature || 'null',
        computedDigest: digest,
      }
    }, { status: 401 })
  }

  try {
    const payload = JSON.parse(rawBody) as {
      events?: Array<{
        replyToken?: string
        source?: {
          groupId?: string
          roomId?: string
          type?: string
          userId?: string
        }
        message?: {
          text?: string
          type?: string
        }
        type?: string
      }>
    }
    const sources = (payload.events ?? []).map((event) => ({
      groupId: event.source?.groupId,
      roomId: event.source?.roomId,
      sourceType: event.source?.type,
      type: event.type,
      userId: event.source?.userId,
    }))
    if (sources.length > 0) {
      console.info('[line-webhook] received sources', sources)
    }

    // Load channel access token to auto-reply with IDs
    const config = await prisma.system_settings.findUnique({
      where: { key: 'LINE_CHANNEL_ACCESS_TOKEN' },
    })
    const token = config?.value || process.env.LINE_CHANNEL_ACCESS_TOKEN

    if (token) {
      for (const event of payload.events ?? []) {
        // Auto-upsert group information
        if (event.source?.type === 'group' && event.source.groupId) {
          await upsertLineGroup(event.source.groupId, token)
        }

        if (!event.replyToken) continue

        const isJoin = event.type === 'join'
        const isMsgId =
          event.type === 'message' &&
          event.message?.type === 'text' &&
          ['/id', '/info', 'id', 'Group ID', 'Group ID?'].includes(event.message?.text?.trim() ?? '')

        if (isJoin || isMsgId) {
          let replyText = 'ไม่สามารถระบุ ID ได้'
          if (event.source?.type === 'group' && event.source.groupId) {
            replyText = `Group ID ของห้องนี้คือ:\n${event.source.groupId}`
          } else if (event.source?.type === 'room' && event.source.roomId) {
            replyText = `Room ID ของห้องนี้คือ:\n${event.source.roomId}`
          } else if (event.source?.type === 'user' && event.source.userId) {
            replyText = `User ID ของคุณคือ:\n${event.source.userId}`
          }

          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              replyToken: event.replyToken,
              messages: [
                {
                  type: 'text',
                  text: replyText,
                },
              ],
            }),
          }).catch((err) => console.error('[line-webhook] reply failed', err))
        }
      }
    }
  } catch {
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ ok: true })
}
