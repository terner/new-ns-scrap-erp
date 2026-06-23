import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/server/prisma'

export type LineTargetType = 'group' | 'room' | 'user'

export type LineMessagingConfig = {
  channelAccessToken: string
  channelSecret: string | null
  defaultTargetId: string | null
  pdfBucket: string
}

type LineSettingsRow = {
  auto_send_wti: boolean
  auto_send_wto: boolean
  channel_access_token_encrypted: string | null
  channel_access_token_hint: string | null
  channel_id: string | null
  channel_secret_encrypted: string | null
  channel_secret_hint: string | null
  default_target_id: bigint | null
  id: bigint
  last_test_sent_at: Date | null
  last_token_verified_at: Date | null
  last_webhook_checked_at: Date | null
  last_webhook_set_at: Date | null
  last_webhook_tested_at: Date | null
  pdf_bucket: string
  webhook_url: string | null
}

type LineTargetRow = {
  active: boolean
  branch_code: string | null
  display_name: string | null
  id: bigint
  is_default: boolean
  last_seen_at: Date | null
  send_wti: boolean
  send_wto: boolean
  target_id: string
  target_type: LineTargetType
}

type LineWebhookEventRow = {
  event_type: string
  group_id: string | null
  id: bigint
  received_at: Date
  room_id: string | null
  source_id: string | null
  source_type: string | null
  user_id: string | null
}

export type LineSettingsPayload = {
  defaultWebhookUrl: string
  env: {
    hasDefaultTargetId: boolean
    hasLineAccessToken: boolean
    hasLineChannelSecret: boolean
  }
  recentEvents: Array<{
    eventType: string
    id: string
    receivedAt: string
    sourceId: string | null
    sourceType: string | null
  }>
  settings: {
    accessTokenHint: string | null
    autoSendWti: boolean
    autoSendWto: boolean
    channelId: string | null
    channelSecretHint: string | null
    defaultTargetDbId: string | null
    hasAccessToken: boolean
    hasChannelSecret: boolean
    lastTestSentAt: string | null
    lastTokenVerifiedAt: string | null
    lastWebhookCheckedAt: string | null
    lastWebhookSetAt: string | null
    lastWebhookTestedAt: string | null
    pdfBucket: string
    webhookUrl: string | null
  }
  targets: Array<{
    active: boolean
    branchCode: string | null
    displayName: string | null
    id: string
    isDefault: boolean
    lastSeenAt: string | null
    sendWti: boolean
    sendWto: boolean
    targetId: string
    targetType: LineTargetType
  }>
}

export type SaveLineSettingsInput = {
  autoSendWti: boolean
  autoSendWto: boolean
  channelAccessToken?: string
  channelId?: string | null
  channelSecret?: string
  defaultTargetDbId?: string | null
  pdfBucket: string
  webhookUrl?: string | null
}

export type SaveLineTargetInput = {
  active: boolean
  branchCode?: string | null
  displayName?: string | null
  id?: string
  isDefault: boolean
  sendWti: boolean
  sendWto: boolean
  targetId: string
  targetType: LineTargetType
}

type LineWebhookPayload = {
  events?: Array<{
    deliveryContext?: { isRedelivery?: boolean }
    mode?: string
    source?: {
      groupId?: string
      roomId?: string
      type?: string
      userId?: string
    }
    timestamp?: number
    type?: string
    webhookEventId?: string
  }>
}

function encryptionKey() {
  const source = process.env.LINE_SETTINGS_ENCRYPTION_KEY
    ?? process.env.SUPABASE_SERVICE_ROLE_KEY
    ?? process.env.DATABASE_URL
  if (!source) {
    throw new Error('ยังไม่มี server secret สำหรับเข้ารหัส LINE settings')
  }
  return createHash('sha256').update(source).digest()
}

function encryptSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`
}

function decryptSecret(value: string | null) {
  if (!value) return null
  const [version, ivValue, tagValue, encryptedValue] = value.split(':')
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('รูปแบบ secret ของ LINE ไม่ถูกต้อง')
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

function secretHint(value: string) {
  if (value.length <= 10) return `${value.slice(0, 2)}...${value.slice(-2)}`
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function iso(value: Date | null) {
  return value ? value.toISOString() : null
}

export function lineWebhookUrl(origin: string) {
  return new URL('/api/line/webhook', origin).toString()
}

async function getSettingsRow() {
  const rows = await prisma.$queryRaw<LineSettingsRow[]>`
    select
      id,
      channel_id,
      channel_access_token_encrypted,
      channel_access_token_hint,
      channel_secret_encrypted,
      channel_secret_hint,
      webhook_url,
      default_target_id,
      auto_send_wti,
      auto_send_wto,
      pdf_bucket,
      last_token_verified_at,
      last_webhook_checked_at,
      last_webhook_set_at,
      last_webhook_tested_at,
      last_test_sent_at
    from public.line_integration_settings
    where setting_key = 'default'
    limit 1
  `
  return rows[0] ?? null
}

async function ensureSettingsRow() {
  await prisma.$executeRaw`
    insert into public.line_integration_settings (setting_key)
    values ('default')
    on conflict (setting_key) do nothing
  `
  return getSettingsRow()
}

async function listTargets() {
  return prisma.$queryRaw<LineTargetRow[]>`
    select
      id,
      target_type,
      target_id,
      display_name,
      branch_code,
      send_wti,
      send_wto,
      active,
      is_default,
      last_seen_at
    from public.line_integration_targets
    order by is_default desc, active desc, coalesce(last_seen_at, discovered_at) desc, id desc
  `
}

async function listRecentEvents() {
  return prisma.$queryRaw<LineWebhookEventRow[]>`
    select id, event_type, source_type, source_id, group_id, room_id, user_id, received_at
    from public.line_webhook_events
    order by received_at desc
    limit 12
  `
}

function targetJson(row: LineTargetRow) {
  return {
    active: row.active,
    branchCode: row.branch_code,
    displayName: row.display_name,
    id: row.id.toString(),
    isDefault: row.is_default,
    lastSeenAt: iso(row.last_seen_at),
    sendWti: row.send_wti,
    sendWto: row.send_wto,
    targetId: row.target_id,
    targetType: row.target_type,
  }
}

export async function getLineSettingsPayload(origin: string): Promise<LineSettingsPayload> {
  const [settingsRow, targets, events] = await Promise.all([
    ensureSettingsRow(),
    listTargets(),
    listRecentEvents(),
  ])
  const settings = settingsRow ?? await ensureSettingsRow()
  const defaultWebhookUrl = lineWebhookUrl(origin)
  return {
    defaultWebhookUrl,
    env: {
      hasDefaultTargetId: Boolean(process.env.LINE_DEFAULT_TARGET_ID),
      hasLineAccessToken: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
      hasLineChannelSecret: Boolean(process.env.LINE_CHANNEL_SECRET),
    },
    recentEvents: events.map((event) => ({
      eventType: event.event_type,
      id: event.id.toString(),
      receivedAt: event.received_at.toISOString(),
      sourceId: event.source_id,
      sourceType: event.source_type,
    })),
    settings: {
      accessTokenHint: settings?.channel_access_token_hint ?? null,
      autoSendWti: settings?.auto_send_wti ?? false,
      autoSendWto: settings?.auto_send_wto ?? false,
      channelId: settings?.channel_id ?? null,
      channelSecretHint: settings?.channel_secret_hint ?? null,
      defaultTargetDbId: settings?.default_target_id?.toString() ?? null,
      hasAccessToken: Boolean(settings?.channel_access_token_encrypted || process.env.LINE_CHANNEL_ACCESS_TOKEN),
      hasChannelSecret: Boolean(settings?.channel_secret_encrypted || process.env.LINE_CHANNEL_SECRET),
      lastTestSentAt: iso(settings?.last_test_sent_at ?? null),
      lastTokenVerifiedAt: iso(settings?.last_token_verified_at ?? null),
      lastWebhookCheckedAt: iso(settings?.last_webhook_checked_at ?? null),
      lastWebhookSetAt: iso(settings?.last_webhook_set_at ?? null),
      lastWebhookTestedAt: iso(settings?.last_webhook_tested_at ?? null),
      pdfBucket: settings?.pdf_bucket ?? 'weight-ticket-pdfs',
      webhookUrl: settings?.webhook_url ?? defaultWebhookUrl,
    },
    targets: targets.map(targetJson),
  }
}

export async function saveLineSettings(input: SaveLineSettingsInput, updatedBy: string) {
  const existing = await ensureSettingsRow()
  const encryptedToken = input.channelAccessToken
    ? encryptSecret(input.channelAccessToken)
    : existing?.channel_access_token_encrypted ?? null
  const encryptedSecret = input.channelSecret
    ? encryptSecret(input.channelSecret)
    : existing?.channel_secret_encrypted ?? null
  const tokenHint = input.channelAccessToken
    ? secretHint(input.channelAccessToken)
    : existing?.channel_access_token_hint ?? null
  const channelSecretHint = input.channelSecret
    ? secretHint(input.channelSecret)
    : existing?.channel_secret_hint ?? null
  const defaultTargetDbId = input.defaultTargetDbId ? BigInt(input.defaultTargetDbId) : null
  if (defaultTargetDbId) {
    await prisma.$executeRaw`update public.line_integration_targets set is_default = false where is_default = true`
    await prisma.$executeRaw`update public.line_integration_targets set is_default = true, active = true, updated_at = now() where id = ${defaultTargetDbId}`
  }

  await prisma.$executeRaw`
    insert into public.line_integration_settings (
      setting_key,
      channel_id,
      channel_access_token_encrypted,
      channel_access_token_hint,
      channel_secret_encrypted,
      channel_secret_hint,
      webhook_url,
      default_target_id,
      auto_send_wti,
      auto_send_wto,
      pdf_bucket,
      updated_by
    ) values (
      'default',
      ${input.channelId ?? null},
      ${encryptedToken},
      ${tokenHint},
      ${encryptedSecret},
      ${channelSecretHint},
      ${input.webhookUrl ?? null},
      ${defaultTargetDbId},
      ${input.autoSendWti},
      ${input.autoSendWto},
      ${input.pdfBucket},
      ${updatedBy}
    )
    on conflict (setting_key) do update set
      channel_id = excluded.channel_id,
      channel_access_token_encrypted = excluded.channel_access_token_encrypted,
      channel_access_token_hint = excluded.channel_access_token_hint,
      channel_secret_encrypted = excluded.channel_secret_encrypted,
      channel_secret_hint = excluded.channel_secret_hint,
      webhook_url = excluded.webhook_url,
      default_target_id = excluded.default_target_id,
      auto_send_wti = excluded.auto_send_wti,
      auto_send_wto = excluded.auto_send_wto,
      pdf_bucket = excluded.pdf_bucket,
      updated_by = excluded.updated_by,
      updated_at = now()
  `
}

export async function saveLineTarget(input: SaveLineTargetInput) {
  const id = input.id ? BigInt(input.id) : null
  const active = input.isDefault ? true : input.active
  if (input.isDefault) {
    await prisma.$executeRaw`update public.line_integration_targets set is_default = false where is_default = true`
  }
  if (id) {
    await prisma.$executeRaw`
      update public.line_integration_targets
      set
        target_type = ${input.targetType},
        target_id = ${input.targetId},
        display_name = ${input.displayName ?? null},
        branch_code = ${input.branchCode ?? null},
        send_wti = ${input.sendWti},
        send_wto = ${input.sendWto},
        active = ${active},
        is_default = ${input.isDefault},
        updated_at = now()
      where id = ${id}
    `
    if (!input.isDefault) {
      await prisma.$executeRaw`
        update public.line_integration_settings
        set default_target_id = null, updated_at = now()
        where default_target_id = ${id}
      `
    }
  } else {
    await prisma.$executeRaw`
      insert into public.line_integration_targets (
        target_type,
        target_id,
        display_name,
        branch_code,
        send_wti,
        send_wto,
        active,
        is_default,
        last_seen_at
      ) values (
        ${input.targetType},
        ${input.targetId},
        ${input.displayName ?? null},
        ${input.branchCode ?? null},
        ${input.sendWti},
        ${input.sendWto},
        ${active},
        ${input.isDefault},
        now()
      )
      on conflict (target_id) do update set
        target_type = excluded.target_type,
        display_name = excluded.display_name,
        branch_code = excluded.branch_code,
        send_wti = excluded.send_wti,
        send_wto = excluded.send_wto,
        active = excluded.active,
        is_default = excluded.is_default,
        updated_at = now()
    `
  }
  const targetRows = await prisma.$queryRaw<Array<{ id: bigint }>>`
    select id from public.line_integration_targets where target_id = ${input.targetId} limit 1
  `
  const targetDbId = targetRows[0]?.id ?? id
  if (input.isDefault) {
    if (targetDbId) {
      await prisma.$executeRaw`
        update public.line_integration_settings
        set default_target_id = ${targetDbId}, updated_at = now()
        where setting_key = 'default'
      `
    }
  } else if (targetDbId) {
    await prisma.$executeRaw`
      update public.line_integration_settings
      set default_target_id = null, updated_at = now()
      where default_target_id = ${targetDbId}
    `
  }
}

export async function resolveLineMessagingConfig(): Promise<LineMessagingConfig> {
  const settings = await getSettingsRow()
  const channelAccessToken = decryptSecret(settings?.channel_access_token_encrypted ?? null)
    ?? process.env.LINE_CHANNEL_ACCESS_TOKEN
    ?? ''
  if (!channelAccessToken) {
    throw new Error('ยังไม่ได้ตั้งค่า LINE Channel access token')
  }
  const channelSecret = decryptSecret(settings?.channel_secret_encrypted ?? null)
    ?? process.env.LINE_CHANNEL_SECRET
    ?? null
  const defaultTargetRows = await prisma.$queryRaw<Array<{ target_id: string }>>`
    select target_id
    from public.line_integration_targets
    where active = true and is_default = true
    order by updated_at desc
    limit 1
  `
  return {
    channelAccessToken,
    channelSecret,
    defaultTargetId: defaultTargetRows[0]?.target_id ?? process.env.LINE_DEFAULT_TARGET_ID ?? null,
    pdfBucket: settings?.pdf_bucket ?? process.env.WEIGHT_TICKET_PDF_BUCKET ?? 'weight-ticket-pdfs',
  }
}

export async function resolveLineNotificationTargets(type: 'WTI' | 'WTO', branchCode: string, defaultTargetId?: string | null) {
  if (defaultTargetId) return [defaultTargetId]

  const rows = await prisma.$queryRaw<Array<{ target_id: string }>>`
    select target_id
    from public.line_integration_targets
    where active = true
      and target_type = 'group'
      and case when ${type} = 'WTI' then send_wti else send_wto end
      and (
        branch_code is null
        or trim(branch_code) = ''
        or upper(branch_code) = upper(${branchCode})
      )
    order by
      case when branch_code is null or trim(branch_code) = '' then 1 else 0 end,
      coalesce(last_seen_at, discovered_at) desc,
      id desc
  `
  return [...new Set(rows.map((row) => row.target_id))]
}

async function resolveLineTestTargets(defaultTargetId?: string | null) {
  if (defaultTargetId) return [defaultTargetId]

  const rows = await prisma.$queryRaw<Array<{ target_id: string }>>`
    select target_id
    from public.line_integration_targets
    where active = true
      and target_type = 'group'
    order by coalesce(last_seen_at, discovered_at) desc, id desc
  `
  return [...new Set(rows.map((row) => row.target_id))]
}

export async function resolveLineChannelSecret() {
  const settings = await getSettingsRow()
  return decryptSecret(settings?.channel_secret_encrypted ?? null)
    ?? process.env.LINE_CHANNEL_SECRET
    ?? null
}

export async function shouldAutoNotifyWeightTicket(type: 'WTI' | 'WTO') {
  const settings = await getSettingsRow()
  return type === 'WTI'
    ? settings?.auto_send_wti === true
    : settings?.auto_send_wto === true
}

async function lineApiFetch<T>(accessToken: string, url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(url, {
    ...init,
    headers,
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) as T : {} as T
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'message' in payload
      ? String((payload as { message?: unknown }).message)
      : text
    throw new Error(`LINE API ไม่สำเร็จ (${response.status}): ${message}`)
  }
  return payload
}

export async function verifyLineToken() {
  const { channelAccessToken } = await resolveLineMessagingConfig()
  const url = new URL('https://api.line.me/oauth2/v2.1/verify')
  url.searchParams.set('access_token', channelAccessToken)
  const verify = await fetch(url, { method: 'GET' })
  const verifyPayload = await verify.json() as {
    client_id?: string
    expires_in?: number
    scope?: string
    error?: string
    error_description?: string
  }
  if (!verify.ok) {
    throw new Error(`ตรวจ LINE token ไม่สำเร็จ: ${verifyPayload.error_description ?? verifyPayload.error ?? verify.statusText}`)
  }
  const bot = await lineApiFetch<{
    basicId?: string
    chatMode?: string
    displayName?: string
    markAsReadMode?: string
    premiumId?: string
    userId?: string
  }>(channelAccessToken, 'https://api.line.me/v2/bot/info', { method: 'GET' })
  await prisma.$executeRaw`
    update public.line_integration_settings
    set channel_id = coalesce(channel_id, ${verifyPayload.client_id ?? null}),
        last_token_verified_at = now(),
        updated_at = now()
    where setting_key = 'default'
  `
  return {
    bot,
    verify: verifyPayload,
  }
}

export async function setLineWebhook(endpoint: string) {
  const { channelAccessToken } = await resolveLineMessagingConfig()
  await lineApiFetch<{ endpoint?: string }>(channelAccessToken, 'https://api.line.me/v2/bot/channel/webhook/endpoint', {
    body: JSON.stringify({ endpoint }),
    method: 'PUT',
  })
  await prisma.$executeRaw`
    update public.line_integration_settings
    set webhook_url = ${endpoint},
        last_webhook_set_at = now(),
        updated_at = now()
    where setting_key = 'default'
  `
}

export async function getLineWebhookInfo() {
  const { channelAccessToken } = await resolveLineMessagingConfig()
  const info = await lineApiFetch<{ active?: boolean; endpoint?: string }>(
    channelAccessToken,
    'https://api.line.me/v2/bot/channel/webhook/endpoint',
    { method: 'GET' },
  )
  await prisma.$executeRaw`
    update public.line_integration_settings
    set webhook_url = ${info.endpoint ?? null},
        last_webhook_checked_at = now(),
        updated_at = now()
    where setting_key = 'default'
  `
  return info
}

export async function testLineWebhook(endpoint?: string) {
  const { channelAccessToken } = await resolveLineMessagingConfig()
  const body = endpoint ? JSON.stringify({ endpoint }) : undefined
  const result = await lineApiFetch<{ reason?: string; success?: boolean; timestamp?: string }>(
    channelAccessToken,
    'https://api.line.me/v2/bot/channel/webhook/test',
    {
      body,
      method: 'POST',
    },
  )
  await prisma.$executeRaw`
    update public.line_integration_settings
    set last_webhook_tested_at = now(),
        updated_at = now()
    where setting_key = 'default'
  `
  return result
}

export async function sendLineTestMessage(targetId?: string | null) {
  const { channelAccessToken, defaultTargetId } = await resolveLineMessagingConfig()
  const targetIds = targetId ? [targetId] : await resolveLineTestTargets(defaultTargetId)
  if (targetIds.length === 0) throw new Error('ยังไม่พบกลุ่ม LINE ที่เปิดใช้งานจาก webhook')

  const results = []
  for (const to of targetIds) {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      body: JSON.stringify({
        messages: [{
          text: `NS Scrap ERP ทดสอบส่ง LINE สำเร็จ ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`,
          type: 'text',
        }],
        to,
      }),
      headers: {
        Authorization: `Bearer ${channelAccessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })
    if (!response.ok) {
      results.push({ error: await response.text(), status: 'failed' as const, targetId: to })
      continue
    }
    results.push({
      lineRequestId: response.headers.get('x-line-request-id'),
      status: 'sent' as const,
      targetId: to,
    })
  }
  const sentResults = results.filter((result) => result.status === 'sent')
  if (sentResults.length === 0) {
    throw new Error(`ส่งข้อความทดสอบไม่สำเร็จทุกกลุ่ม: ${JSON.stringify(results)}`)
  }
  await prisma.$executeRaw`
    update public.line_integration_settings
    set last_test_sent_at = now(),
        updated_at = now()
    where setting_key = 'default'
  `
  return {
    results,
    sentCount: sentResults.length,
    targetCount: targetIds.length,
  }
}

export async function recordLineWebhookEvents(payload: LineWebhookPayload) {
  for (const event of payload.events ?? []) {
    const source = event.source
    const sourceType = source?.type ?? null
    const sourceId = source?.groupId ?? source?.roomId ?? source?.userId ?? null
    if (sourceType && sourceId && (sourceType === 'group' || sourceType === 'room' || sourceType === 'user')) {
      const targetType = sourceType as LineTargetType
      const label = targetType === 'group' ? 'LINE group' : targetType === 'room' ? 'LINE room' : 'LINE user'
      await prisma.$executeRaw`
        insert into public.line_integration_targets (
          target_type,
          target_id,
          display_name,
          active,
          last_seen_at
        ) values (
          ${targetType},
          ${sourceId},
          ${`${label} ${sourceId.slice(-6)}`},
          true,
          now()
        )
        on conflict (target_id) do update set
          last_seen_at = now(),
          updated_at = now(),
          display_name = coalesce(public.line_integration_targets.display_name, excluded.display_name),
          active = true
      `
    }
    await prisma.$executeRaw`
      insert into public.line_webhook_events (
        event_type,
        source_type,
        source_id,
        group_id,
        room_id,
        user_id,
        payload
      ) values (
        ${event.type ?? 'unknown'},
        ${sourceType},
        ${sourceId},
        ${source?.groupId ?? null},
        ${source?.roomId ?? null},
        ${source?.userId ?? null},
        ${JSON.stringify({
          deliveryContext: event.deliveryContext,
          mode: event.mode,
          timestamp: event.timestamp,
          webhookEventId: event.webhookEventId,
        })}::jsonb
      )
    `
  }
}
