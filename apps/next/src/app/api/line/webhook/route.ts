import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import type { Prisma } from '../../../../../generated/prisma/client'
import { prisma } from '@/lib/server/prisma'
import { acquireLineCredentialReadLock } from '@/lib/server/line-credential-lock'
import { formatWeight } from '@/lib/weight-tickets'
import { enqueueNotificationJob, executeNotificationJob } from '@/lib/server/line-notification-jobs'

export const runtime = 'nodejs'

type LineWebhookTransaction = Pick<
  Prisma.TransactionClient,
  | 'branches'
  | 'line_command_permissions'
  | 'line_notification_jobs'
  | 'line_targets'
  | 'system_settings'
  | 'weight_tickets'
>

function formatDateTime(value?: string | Date | null) {
  if (!value) return '-'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('th-TH', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Bangkok'
  })
}

async function verifyLineSignature(
  database: LineWebhookTransaction,
  rawBody: string,
  signature: string | null,
) {
  const config = await database.system_settings.findUnique({
    where: { key: 'LINE_CHANNEL_SECRET' },
  })
  const secret = config?.value || process.env.LINE_CHANNEL_SECRET || ''
  if (!secret || !signature) {
    console.error('[line-webhook] signature verification unavailable')
    return false
  }
  const digest = createHmac('sha256', secret).update(rawBody).digest('base64')
  const expected = Buffer.from(digest)
  const received = Buffer.from(signature)
  const matched = expected.length === received.length && timingSafeEqual(expected, received)

  if (!matched) {
    console.error('[line-webhook] signature verification failed')
  }

  return matched
}

async function upsertLineTarget(
  database: LineWebhookTransaction,
  targetId: string,
  targetType: 'group' | 'room' | 'user',
  token: string,
  lastEventType?: string,
) {
  let name = `${targetType === 'group' ? 'กลุ่มไลน์' : targetType === 'room' ? 'ห้องไลน์' : 'ผู้ใช้งาน'} ${targetId.slice(0, 6)}...`
  let pictureUrl: string | null = null

  try {
    if (targetType === 'group') {
      const res = await fetch(`https://api.line.me/v2/bot/group/${targetId}/summary`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const body = await res.json() as { groupName?: string; pictureUrl?: string }
        if (body.groupName) name = body.groupName
        if (body.pictureUrl) pictureUrl = body.pictureUrl
      }
    } else if (targetType === 'user') {
      const res = await fetch(`https://api.line.me/v2/bot/profile/${targetId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const body = await res.json() as { displayName?: string; pictureUrl?: string }
        if (body.displayName) name = body.displayName
        if (body.pictureUrl) pictureUrl = body.pictureUrl
      }
    }
  } catch {
    // Profile enrichment is best-effort; target registration itself must still persist.
    console.warn('[line-webhook] target profile refresh failed')
  }

  await database.line_targets.upsert({
    where: { target_id: targetId },
    create: {
      target_id: targetId,
      target_type: targetType,
      display_name: name,
      picture_url: pictureUrl,
      last_seen_at: new Date(),
      last_event_type: lastEventType || 'webhook',
      is_active: true,
    },
    update: {
      display_name: name,
      picture_url: pictureUrl,
      last_seen_at: new Date(),
      last_event_type: lastEventType || 'webhook',
      is_active: true,
      updated_at: new Date(),
    },
  })
}

async function checkCommandPermission(
  database: LineWebhookTransaction,
  targetId: string,
  userId: string | null | undefined,
  command: string,
): Promise<boolean> {
  const perm = await database.line_command_permissions.findFirst({
    where: {
      target_id: targetId,
      OR: [
        { user_id: null },
        userId ? { user_id: userId } : undefined
      ].filter(Boolean) as any,
      command: command,
      is_allowed: true
    }
  })
  return !!perm
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature')
  try {
    return await prisma.$transaction(async (transaction) => {
      await acquireLineCredentialReadLock(transaction)
      if (!(await verifyLineSignature(transaction, rawBody, signature))) {
        return NextResponse.json({
          code: 'INVALID_SIGNATURE',
          error: 'LINE signature ไม่ถูกต้อง'
        }, { status: 401 })
      }

      const payload = JSON.parse(rawBody) as {
        events?: Array<{
          replyToken?: string
          source?: {
            groupId?: string
            roomId?: string
            type?: 'group' | 'room' | 'user'
            userId?: string
          }
          message?: {
            text?: string
            type?: string
          }
          type?: string
        }>
      }

      // Load channel access token for replies and profile fetching
      const config = await transaction.system_settings.findUnique({
        where: { key: 'LINE_CHANNEL_ACCESS_TOKEN' },
      })
      const token = config?.value || process.env.LINE_CHANNEL_ACCESS_TOKEN
      const events = payload.events ?? []

      if (!token && events.length > 0) {
        return NextResponse.json({
          code: 'LINE_CREDENTIALS_MISSING',
          error: 'ระบบยังไม่ได้ตั้งค่า LINE Channel Access Token',
        }, { status: 503 })
      }

      if (token) {
        for (const event of events) {
          const targetId = event.source?.groupId || event.source?.roomId || event.source?.userId
          const targetType = event.source?.type || 'user'
          const userId = event.source?.userId

          if (!targetId) continue

          // 1. Handle Join / Member events
          if (event.type === 'join') {
            await upsertLineTarget(transaction, targetId, targetType, token, 'join')
          }

          // 2. Handle Leave event
          if (event.type === 'leave') {
            await transaction.line_targets.updateMany({
              where: { target_id: targetId },
              data: {
                is_active: false,
                last_event_type: 'leave',
                last_seen_at: new Date()
              }
            })
            continue
          }

          // 3. Handle messages
          if (event.type === 'message' && event.message?.type === 'text') {
            // Sync last seen
            await upsertLineTarget(transaction, targetId, targetType, token, 'message')

            const text = (event.message?.text || '').trim()
            if (!text.startsWith('/')) continue // Ignore non-slash commands

            const parts = text.split(/\s+/)
            const command = parts[0].toLowerCase()
            let replyText = ''

            // 4. Command Authorization Gate
            const sensitiveCommands = ['/latest', '/pdf', '/status', '/retry', '/today', '/summary', '/settings']
            if (sensitiveCommands.includes(command)) {
              const allowed = await checkCommandPermission(transaction, targetId, userId, command)
              if (!allowed) {
                replyText = `⚠️ ขออภัย คุณไม่มีสิทธิ์ใช้งานคำสั่ง ${command} ในห้องนี้\n(ต้องการสิทธิ์ โปรดติดต่อผู้ดูแลระบบเพื่อเปิดสิทธิ์สำหรับ ID: ${targetId})`
              }
            }

            // 5. Execute commands if no permission barrier yet
            if (!replyText) {
              if (command === '/help') {
                replyText = `🤖 ยินดีต้อนรับสู่ NS Scrap ERP Bot!\nคำสั่งที่ใช้งานได้:\n• /id - แสดง ID ของห้องนี้\n• /register - ลงทะเบียนห้องนี้ในระบบ\n• /register สาขา=[code] name=[name] - ลงทะเบียนระบุสาขาและชื่อกลุ่ม\n• /latest WTI หรือ /latest WTO - ดูใบชั่งน้ำหนักล่าสุด\n• /pdf [เลขที่ใบชั่ง] - ขอลิงก์ดาวน์โหลด PDF\n• /status [เลขที่ใบชั่ง] - ดูสถานะส่งไลน์\n• /retry [เลขที่ใบชั่ง] - ส่งใบชั่งน้ำหนักใหม่อีกครั้ง\n• /today - สรุปยอดใบชั่งวันนี้\n• /summary [YYYY-MM-DD] - สรุปยอดใบชั่งระบุวันที่\n• /settings - ดูการตั้งค่าของกลุ่มนี้`
              } else if (command === '/id' || command === '/info') {
                replyText = `📍 รายละเอียดแชท:\n• Target ID: ${targetId}\n• ประเภท: ${targetType.toUpperCase()}\n` +
                            (userId ? `• User ID ของคุณ: ${userId}` : '')
              } else if (command === '/register') {
                let branchCode = null
                let displayName = null
                const argsText = text.substring(command.length).trim()
                if (argsText) {
                  const branchMatch = argsText.match(/(?:branch|สาขา)\s*=\s*([^\s"]+|"[^"]+")/i)
                  const nameMatch = argsText.match(/(?:name|ชื่อ)\s*=\s*([^\s"]+|"[^"]+")/i)

                  if (branchMatch) {
                    branchCode = branchMatch[1].replace(/"/g, '').trim()
                  }
                  if (nameMatch) {
                    displayName = nameMatch[1].replace(/"/g, '').trim()
                  }
                }

                let name = displayName
                if (!name) {
                  const targetRow = await transaction.line_targets.findUnique({ where: { target_id: targetId } })
                  name = targetRow?.display_name || `${targetType === 'group' ? 'กลุ่มไลน์' : targetType === 'room' ? 'ห้องไลน์' : 'ผู้ใช้งาน'} ${targetId.slice(0, 6)}...`
                }

                if (branchCode) {
                  const branchExists = await transaction.branches.findFirst({ where: { code: branchCode } })
                  if (!branchExists) {
                    const branchByName = await transaction.branches.findFirst({ where: { name: { contains: branchCode } } })
                    if (branchByName) {
                      branchCode = branchByName.code
                    }
                  }
                }

                await transaction.line_targets.upsert({
                  where: { target_id: targetId },
                  create: {
                    target_id: targetId,
                    target_type: targetType,
                    display_name: name,
                    branch_code: branchCode || null,
                    is_active: true,
                    registered_by: 'bot_command',
                    last_seen_at: new Date(),
                    last_event_type: 'register'
                  },
                  update: {
                    display_name: name,
                    branch_code: branchCode !== undefined ? branchCode : undefined,
                    is_active: true,
                    last_seen_at: new Date(),
                    last_event_type: 'register'
                  }
                })

                replyText = `✅ ลงทะเบียนกลุ่มรับการแจ้งเตือนสำเร็จ!\n• ชื่อ: ${name}\n• ID: ${targetId}\n• สาขา: ${branchCode || 'ทุกสาขา'}`
              } else if (command === '/latest') {
                const docType = parts[1]?.toUpperCase() || 'WTI'
                if (docType !== 'WTI' && docType !== 'WTO') {
                  replyText = `⚠️ รูปแบบคำสั่งไม่ถูกต้อง กรุณาพิมพ์ /latest WTI หรือ /latest WTO`
                } else {
                  const target = await transaction.line_targets.findUnique({ where: { target_id: targetId } })
                  const latest = await transaction.weight_tickets.findFirst({
                    where: {
                      doc_type: docType === 'WTI' ? 'WTI' : 'WTO',
                      branches: target?.branch_code ? { code: target.branch_code } : undefined,
                    },
                    orderBy: { created_at: 'desc' }
                  })
                  if (!latest) {
                    replyText = `ไม่พบข้อมูลใบชั่งน้ำหนักประเภท ${docType} ล่าสุด`
                  } else {
                    replyText = `📄 ใบชั่งล่าสุด (${docType}):\nเลขที่: ${latest.doc_no}\nคู่ค้า: ${latest.party_name || '-'}\nวันที่: ${formatDateTime(latest.document_date)}\nน้ำหนักสุทธิ: ${formatWeight(Number(latest.net_weight))} กก.\n\nดูไฟล์ PDF: /pdf ${latest.doc_no}\nดูสถานะคิว: /status ${latest.doc_no}`
                  }
                }
              } else if (command === '/pdf') {
                const docNo = parts[1]?.trim()
                if (!docNo) {
                  replyText = `⚠️ กรุณาระบุเลขที่ใบชั่ง เช่น /pdf WTI012606-0022`
                } else {
                  const ticket = await transaction.weight_tickets.findFirst({ where: { doc_no: docNo } })
                  if (!ticket) {
                    replyText = `ไม่พบเอกสารใบชั่งน้ำหนักเลขที่ ${docNo}`
                  } else {
                    const lastJob = await transaction.line_notification_jobs.findFirst({
                      where: { document_no: docNo, pdf_url: { not: null } },
                      orderBy: { created_at: 'desc' }
                    })
                    if (lastJob?.pdf_url) {
                      replyText = `📄 ลิงก์ดาวน์โหลด PDF (${docNo}):\n${lastJob.pdf_url}`
                    } else {
                      replyText = `📄 เอกสารเลขที่ ${docNo}\nยังไม่ได้สร้างไฟล์ PDF ในคิว\nคุณสามารถพิมพ์ /retry ${docNo} เพื่อให้บอทเริ่มส่งและสร้างไฟล์ใหม่ได้`
                    }
                  }
                }
              } else if (command === '/status') {
                const docNo = parts[1]?.trim()
                if (!docNo) {
                  replyText = `⚠️ กรุณาระบุเลขที่ใบชั่ง เช่น /status WTI012606-0022`
                } else {
                  const jobs = await transaction.line_notification_jobs.findMany({
                    where: { document_no: docNo, target_id: targetId },
                    orderBy: { created_at: 'desc' },
                    take: 1
                  })
                  if (jobs.length === 0) {
                    replyText = `ไม่พบรายการคิวส่งแจ้งเตือนของบิล ${docNo} สำหรับห้องนี้`
                  } else {
                    const job = jobs[0]
                    replyText = `📊 สถานะแจ้งเตือนบิล ${docNo}:\n` +
                      `• คิวงาน: ${job.status.toUpperCase()}\n` +
                      `• พยายามแล้ว: ${job.attempt_count}/${job.max_attempts} ครั้ง\n` +
                      `• ล่าสุด: ${formatDateTime(job.updated_at)}\n` +
                      (job.last_error_message ? `• สาเหตุขัดข้อง: ${job.last_error_message}\n` : '') +
                      (job.pdf_url ? `• ลิงก์ PDF: ${job.pdf_url}` : '')
                  }
                }
              } else if (command === '/retry') {
                const docNo = parts[1]?.trim()
                if (!docNo) {
                  replyText = `⚠️ กรุณาระบุเลขที่ใบชั่ง เช่น /retry WTI012606-0022`
                } else {
                  try {
                    const enqueueResult = await enqueueNotificationJob(docNo, {
                      credentialLockHeld: true,
                      requestedBy: `line_bot_${userId || 'unknown'}`,
                      targetId: targetId,
                      force: true
                    })
                    if (enqueueResult.status === 'no_targets') {
                      replyText = `⚠️ ไม่พบเป้าหมายผู้รับในกลุ่ม: ${enqueueResult.message}`
                    } else {
                      replyText = `⏳ กำลังส่งใบชั่ง ${docNo} ใหม่อีกครั้ง...`
                      // Process synchronously to reply immediately with status
                      const results = []
                      for (const j of enqueueResult.jobs) {
                        const res = await executeNotificationJob(j.id, {
                          credentialLockHeld: true,
                          force: true,
                        })
                        results.push(res)
                      }
                      const success = results.find(r => r.status === 'sent')
                      if (success) {
                        replyText = `✅ บังคับส่งใบชั่ง ${docNo} สำเร็จแล้ว!\nดาวน์โหลด PDF: ${success.pdfUrl}`
                      } else {
                        const fail = results.find(r => r.status === 'failed')
                        replyText = `❌ บังคับส่งไม่สำเร็จ: ${fail?.error || 'เกิดปัญหาภายในระบบ'}`
                      }
                    }
                  } catch (err: any) {
                    replyText = `❌ ข้อผิดพลาด: ${err.message}`
                  }
                }
              } else if (command === '/today') {
                const start = new Date()
                start.setHours(0,0,0,0)
                const end = new Date()
                end.setHours(23,59,59,999)

                const target = await transaction.line_targets.findUnique({ where: { target_id: targetId } })
                const tickets = await transaction.weight_tickets.findMany({
                  where: {
                    document_date: { gte: start, lte: end },
                    branches: target?.branch_code ? { code: target.branch_code } : undefined
                  }
                })
                const wtiCount = tickets.filter(t => t.doc_type === 'WTI').length
                const wtoCount = tickets.filter(t => t.doc_type === 'WTO').length
                const totalNet = tickets.reduce((sum, t) => sum + Number(t.net_weight || 0), 0)

                replyText = `📈 ยอดใบชั่งวันนี้ (${new Date().toLocaleDateString('th-TH')}):\n` +
                  `• สาขา: ${target?.branch_code || 'ทุกสาขา'}\n` +
                  `• ใบชั่งรับเข้า WTI: ${wtiCount} ใบ\n` +
                  `• ใบชั่งส่งออก WTO: ${wtoCount} ใบ\n` +
                  `• รวมน้ำหนักสุทธิ: ${formatWeight(totalNet)} กก.`
              } else if (command === '/summary') {
                const dateStr = parts[1]?.trim()
                const targetDate = dateStr ? new Date(dateStr) : null
                if (!targetDate || isNaN(targetDate.getTime())) {
                  replyText = `⚠️ กรุณาระบุวันที่ เช่น /summary 2026-06-24`
                } else {
                  const start = new Date(targetDate)
                  start.setHours(0,0,0,0)
                  const end = new Date(targetDate)
                  end.setHours(23,59,59,999)

                  const target = await transaction.line_targets.findUnique({ where: { target_id: targetId } })
                  const tickets = await transaction.weight_tickets.findMany({
                    where: {
                      document_date: { gte: start, lte: end },
                      branches: target?.branch_code ? { code: target.branch_code } : undefined
                    }
                  })
                  const wtiCount = tickets.filter(t => t.doc_type === 'WTI').length
                  const wtoCount = tickets.filter(t => t.doc_type === 'WTO').length
                  const totalNet = tickets.reduce((sum, t) => sum + Number(t.net_weight || 0), 0)

                  replyText = `📈 ยอดใบชั่งวันที่ ${start.toLocaleDateString('th-TH')}:\n` +
                    `• สาขา: ${target?.branch_code || 'ทุกสาขา'}\n` +
                    `• ใบชั่งรับเข้า WTI: ${wtiCount} ใบ\n` +
                    `• ใบชั่งส่งออก WTO: ${wtoCount} ใบ\n` +
                    `• รวมน้ำหนักสุทธิ: ${formatWeight(totalNet)} กก.`
                }
              } else if (command === '/settings') {
                const target = await transaction.line_targets.findUnique({ where: { target_id: targetId } })
                if (!target) {
                  replyText = `ไม่พบข้อมูลการตั้งค่ากลุ่มนี้ในแผงควบคุม`
                } else {
                  replyText = `⚙️ ข้อมูลและสถานะกลุ่มแชทไลน์:\n` +
                    `• ชื่อกลุ่ม: ${target.display_name}\n` +
                    `• รหัสรับข่าวสาร: ${target.target_id}\n` +
                    `• ประเภทแชท: ${target.target_type.toUpperCase()}\n` +
                    `• สาขาเชื่อมโยง: ${target.branch_code || 'ทุกสาขา'}\n` +
                    `• แจ้งเตือน WTI: ${target.notify_wti ? 'เปิด' : 'ปิด'}\n` +
                    `• แจ้งเตือน WTO: ${target.notify_wto ? 'เปิด' : 'ปิด'}\n` +
                    `• สถานะการส่ง: ${target.is_active ? 'ปกติ' : 'ปิดใช้งาน'}`
                }
              }
            }

            // Reply the text to LINE channel
            if (replyText && event.replyToken) {
              await fetch('https://api.line.me/v2/bot/message/reply', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  replyToken: event.replyToken,
                  messages: [{ type: 'text', text: replyText }],
                }),
              }).catch(() => console.error('[line-webhook] reply failed'))
            }
          }
        }
      }
      return NextResponse.json({ ok: true })
    }, { maxWait: 5_000, timeout: 180_000 })
  } catch {
    console.error('[line-webhook] event processing failed')
    return NextResponse.json({
      code: 'WEBHOOK_PROCESSING_FAILED',
      error: 'ระบบบันทึก LINE webhook event ไม่สำเร็จ',
    }, { status: 500 })
  }
}
