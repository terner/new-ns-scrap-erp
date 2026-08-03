import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { currentActor } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'
import { acquireLineCredentialWriteLock } from '@/lib/server/line-credential-lock'
import { fetchLineBotInfo, isMaskedToken, syncLineTargetsFromAPI } from '@/lib/server/line-target-sync'
import {
  deriveLineWebhookEndpoint,
  getLineWebhookEndpointInfo,
  setLineWebhookEndpoint,
  testLineWebhookEndpoint,
  verifyLineCredentialPair,
} from '@/lib/server/line-webhook-settings'

export const runtime = 'nodejs'

const settingsSchema = z.object({
  lineChannelAccessToken: z.string().trim().nullable().or(z.literal('')),
  lineChannelSecret: z.string().trim().nullable().or(z.literal('')),
  lineDefaultTargetId: z.string().trim().nullable().or(z.literal('')),
  pdfBucket: z.string().trim().min(1, 'ระบุชื่อ Storage Bucket'),
  appUrl: z.string().trim().url('URL ไม่ถูกต้อง').or(z.literal('')),
  lineAutoSend: z.boolean().optional(),
  lineAutoSendWti: z.boolean().default(false),
  lineAutoSendWto: z.boolean().default(false),
  googleSheetsWebhookUrl: z.string().trim().url('URL ไม่ถูกต้อง').or(z.literal('')).nullable().or(z.literal('')),
  lineNotifyTextTemplateWti: z.string().trim().nullable().or(z.literal('')).optional(),
  lineNotifyTextTemplateWto: z.string().trim().nullable().or(z.literal('')).optional(),
  lineAlbumShowBadges: z.boolean().default(true),
  lineAlbumShowTimestamps: z.boolean().default(true),
  lineAlbumQuality: z.number().int().min(10).max(100).default(90),
})

const LINE_CREDENTIAL_SETTING_KEYS = [
  'LINE_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'LINE_DEFAULT_TARGET_ID',
] as const

type LineCredentialSnapshot = {
  appUrl: string | null
  defaultTargetId: string | null
  secret: string | null
  token: string | null
}

function toNullableSetting(value: string | null | undefined): string | null {
  return value || null
}

function snapshotFromSettings(settings: Array<{ key: string; value: string | null }>): LineCredentialSnapshot {
  const values = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
  return {
    appUrl: toNullableSetting(values.NEXT_PUBLIC_APP_URL),
    defaultTargetId: toNullableSetting(values.LINE_DEFAULT_TARGET_ID),
    secret: toNullableSetting(values.LINE_CHANNEL_SECRET),
    token: toNullableSetting(values.LINE_CHANNEL_ACCESS_TOKEN),
  }
}

function credentialsSnapshotChanged(before: LineCredentialSnapshot, after: LineCredentialSnapshot): boolean {
  return before.token !== after.token || before.secret !== after.secret || before.appUrl !== after.appUrl
}

class SafeLineSettingsError extends Error {}

function safeLineSettingsError(message: string): SafeLineSettingsError {
  return new SafeLineSettingsError(message)
}

function isRestorableHttpsEndpoint(endpoint: string | null | undefined): endpoint is string {
  if (!endpoint) return false
  try {
    const url = new URL(endpoint)
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
}

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'system.settings.manage')

    const dbSettings = await prisma.system_settings.findMany({
      where: {
        key: {
          in: [
            'LINE_CHANNEL_ACCESS_TOKEN',
            'LINE_CHANNEL_SECRET',
            'LINE_DEFAULT_TARGET_ID',
            'WEIGHT_TICKET_PDF_BUCKET',
            'NEXT_PUBLIC_APP_URL',
            'LINE_AUTO_SEND',
            'LINE_AUTO_SEND_WTI',
            'LINE_AUTO_SEND_WTO',
            'GOOGLE_SHEETS_WEBHOOK_URL',
            'LINE_NOTIFY_TEXT_TEMPLATE_WTI',
            'LINE_NOTIFY_TEXT_TEMPLATE_WTO',
            'LINE_ALBUM_SHOW_BADGES',
            'LINE_ALBUM_SHOW_TIMESTAMPS',
            'LINE_ALBUM_QUALITY',
          ],
        },
      },
    })

    const configMap = Object.fromEntries(dbSettings.map((s) => [s.key, s.value]))
    const legacyAutoSend = configMap.LINE_AUTO_SEND === 'true'
    const lineAutoSendWti = configMap.LINE_AUTO_SEND_WTI ? configMap.LINE_AUTO_SEND_WTI === 'true' : legacyAutoSend
    const lineAutoSendWto = configMap.LINE_AUTO_SEND_WTO ? configMap.LINE_AUTO_SEND_WTO === 'true' : legacyAutoSend

    const lineNotifyTextTemplateWti = configMap.LINE_NOTIFY_TEXT_TEMPLATE_WTI || ''
    const lineNotifyTextTemplateWto = configMap.LINE_NOTIFY_TEXT_TEMPLATE_WTO || ''
    const lineAlbumShowBadges = configMap.LINE_ALBUM_SHOW_BADGES !== 'false'
    const lineAlbumShowTimestamps = configMap.LINE_ALBUM_SHOW_TIMESTAMPS !== 'false'
    const lineAlbumQuality = configMap.LINE_ALBUM_QUALITY ? parseInt(configMap.LINE_ALBUM_QUALITY, 10) : 90

    const maskSecret = (val: string | null | undefined) => {
      if (!val) return ''
      return '••••••••••••••••'
    }

    return NextResponse.json({
      lineChannelAccessToken: maskSecret(configMap.LINE_CHANNEL_ACCESS_TOKEN),
      lineChannelSecret: maskSecret(configMap.LINE_CHANNEL_SECRET),
      lineDefaultTargetId: configMap.LINE_DEFAULT_TARGET_ID || '',
      pdfBucket: configMap.WEIGHT_TICKET_PDF_BUCKET || 'weight-ticket-pdfs',
      appUrl: configMap.NEXT_PUBLIC_APP_URL || '',
      lineAutoSend: lineAutoSendWti && lineAutoSendWto,
      lineAutoSendWti,
      lineAutoSendWto,
      googleSheetsWebhookUrl: configMap.GOOGLE_SHEETS_WEBHOOK_URL || '',
      lineNotifyTextTemplateWti,
      lineNotifyTextTemplateWto,
      lineAlbumShowBadges,
      lineAlbumShowTimestamps,
      lineAlbumQuality,
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดข้อมูลตั้งค่า LINE ไม่สำเร็จ', 500)
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'system.settings.manage')

    const body = await request.json()
    const values = settingsSchema.parse(body)
    const actor = currentActor(context)
    const hasLegacyAutoSend = typeof values.lineAutoSend === 'boolean'
    const lineAutoSendWti = hasLegacyAutoSend ? values.lineAutoSend === true : values.lineAutoSendWti
    const lineAutoSendWto = hasLegacyAutoSend ? values.lineAutoSend === true : values.lineAutoSendWto
    const legacyAutoSend = lineAutoSendWti && lineAutoSendWto

    const initialSettings = await prisma.system_settings.findMany({
      where: { key: { in: [...LINE_CREDENTIAL_SETTING_KEYS] } },
    })
    const initialSnapshot = snapshotFromSettings(initialSettings)
    const tokenWasMasked = isMaskedToken(values.lineChannelAccessToken)
    const secretWasMasked = isMaskedToken(values.lineChannelSecret)
    const effectiveToken = tokenWasMasked ? initialSnapshot.token : toNullableSetting(values.lineChannelAccessToken)
    const effectiveSecret = secretWasMasked ? initialSnapshot.secret : toNullableSetting(values.lineChannelSecret)
    const tokenChanged = !tokenWasMasked && effectiveToken !== initialSnapshot.token
    const secretChanged = !secretWasMasked && effectiveSecret !== initialSnapshot.secret
    const credentialsChanged = tokenChanged || secretChanged
    const shouldParkExistingTargets = tokenChanged
    const requestOrigin = new URL(request.url).origin
    const requestedAppUrl = requestOrigin.startsWith('https://')
      ? requestOrigin
      : values.appUrl || initialSnapshot.appUrl || requestOrigin
    const webhookEndpoint = effectiveToken ? deriveLineWebhookEndpoint(requestedAppUrl) : null
    const appUrlToPersist = webhookEndpoint ? new URL(webhookEndpoint).origin : values.appUrl || null
    let submittedBotInfo: Awaited<ReturnType<typeof fetchLineBotInfo>> | null = null
    if (credentialsChanged && effectiveToken) {
      if (tokenChanged && secretWasMasked) {
        throw safeLineSettingsError('กรุณากรอก Channel Secret เมื่อเปลี่ยน Channel Access Token')
      }
      if (!effectiveSecret) {
        throw safeLineSettingsError('กรุณากรอก Channel Access Token และ Channel Secret ให้ครบ')
      }
      try {
        submittedBotInfo = await fetchLineBotInfo(effectiveToken)
        await verifyLineCredentialPair(effectiveToken, effectiveSecret)
      } catch {
        throw safeLineSettingsError('Channel Access Token และ Channel Secret ต้องเป็นของ LINE OA เดียวกัน')
      }
    }

    const updates = [
      { key: 'LINE_DEFAULT_TARGET_ID', value: shouldParkExistingTargets ? null : values.lineDefaultTargetId || null },
      { key: 'WEIGHT_TICKET_PDF_BUCKET', value: values.pdfBucket },
      { key: 'NEXT_PUBLIC_APP_URL', value: appUrlToPersist },
      { key: 'LINE_AUTO_SEND', value: legacyAutoSend ? 'true' : 'false' },
      { key: 'LINE_AUTO_SEND_WTI', value: lineAutoSendWti ? 'true' : 'false' },
      { key: 'LINE_AUTO_SEND_WTO', value: lineAutoSendWto ? 'true' : 'false' },
      { key: 'GOOGLE_SHEETS_WEBHOOK_URL', value: values.googleSheetsWebhookUrl || null },
      { key: 'LINE_NOTIFY_TEXT_TEMPLATE_WTI', value: values.lineNotifyTextTemplateWti || null },
      { key: 'LINE_NOTIFY_TEXT_TEMPLATE_WTO', value: values.lineNotifyTextTemplateWto || null },
      { key: 'LINE_ALBUM_SHOW_BADGES', value: values.lineAlbumShowBadges ? 'true' : 'false' },
      { key: 'LINE_ALBUM_SHOW_TIMESTAMPS', value: values.lineAlbumShowTimestamps ? 'true' : 'false' },
      { key: 'LINE_ALBUM_QUALITY', value: String(values.lineAlbumQuality) },
    ]

    if (!isMaskedToken(values.lineChannelAccessToken)) {
      updates.push({ key: 'LINE_CHANNEL_ACCESS_TOKEN', value: values.lineChannelAccessToken || null })
    }
    if (!isMaskedToken(values.lineChannelSecret)) {
      updates.push({ key: 'LINE_CHANNEL_SECRET', value: values.lineChannelSecret || null })
    }

    try {
      await prisma.$transaction(async (transaction) => {
        await acquireLineCredentialWriteLock(transaction)
        const lockedSettings = await transaction.system_settings.findMany({
          where: { key: { in: [...LINE_CREDENTIAL_SETTING_KEYS] } },
        })
        if (credentialsSnapshotChanged(initialSnapshot, snapshotFromSettings(lockedSettings))) {
          throw safeLineSettingsError('มีผู้ดูแลคนอื่นเปลี่ยนการตั้งค่า LINE ระหว่างบันทึก กรุณาโหลดข้อมูลใหม่แล้วลองอีกครั้ง')
        }

        let capturedEndpoint: string | null = null
        let remoteEndpointChanged = false
        try {
          if (effectiveToken && webhookEndpoint) {
            try {
              capturedEndpoint = (await getLineWebhookEndpointInfo(effectiveToken)).endpoint
              await setLineWebhookEndpoint(effectiveToken, webhookEndpoint)
              remoteEndpointChanged = capturedEndpoint !== webhookEndpoint
            } catch {
              throw safeLineSettingsError('ตั้งค่า LINE Webhook ไม่สำเร็จ กรุณาลองอีกครั้ง')
            }
          }

          if (shouldParkExistingTargets) {
            await transaction.line_targets.updateMany({
              data: {
                is_active: false,
                is_default: false,
                last_event_type: 'credentials_changed',
                updated_at: new Date(),
              },
            })
            await transaction.line_notification_jobs.updateMany({
              where: { status: { in: ['pending', 'processing', 'failed'] } },
              data: {
                status: 'skipped',
                locked_at: null,
                locked_by: null,
                last_error_code: 'TARGET_INACTIVE',
                last_error_message: 'LINE target was retired because the LINE OA credentials changed',
                updated_at: new Date(),
              },
            })
          }

          for (const item of updates) {
            await transaction.system_settings.upsert({
              where: { key: item.key },
              create: {
                key: item.key,
                value: item.value,
                updated_by: actor,
              },
              update: {
                value: item.value,
                updated_by: actor,
                updated_at: new Date(),
              },
            })
          }
        } catch (caught) {
          // LINE does not expose a supported "clear endpoint" operation, so
          // empty/non-HTTPS captured values cannot be restored safely.
          if (remoteEndpointChanged && effectiveToken && isRestorableHttpsEndpoint(capturedEndpoint)) {
            try {
              await setLineWebhookEndpoint(effectiveToken, capturedEndpoint)
            } catch {
              // LINE has no supported "clear endpoint" operation. Restoration
              // is best-effort and only attempted for a captured HTTPS URL.
            }
          }
          throw caught
        }
      }, { maxWait: 5_000, timeout: 15_000 })
    } catch (caught) {
      if (caught instanceof SafeLineSettingsError) throw caught
      throw safeLineSettingsError('บันทึกการตั้งค่า LINE ไม่สำเร็จ กรุณาลองอีกครั้ง')
    }

    // Auto-sync targets เมื่อมีการเปลี่ยน token จริง (ไม่ใช่ masked placeholder)
    // sync ล้มเหลวไม่ทำให้การบันทึก token ล้มเหลวด้วย — คืน warning ไปแค่นั้น
    let syncWarning: string | null = null
    if (tokenChanged && effectiveToken) {
      try {
        await syncLineTargetsFromAPI(effectiveToken)
      } catch {
        console.error('[line-settings] auto-sync targets failed')
        syncWarning = 'ซิงค์กลุ่ม LINE ไม่สำเร็จชั่วคราว กรุณาลองอีกครั้ง'
      }
    }

    let lineWebhook: {
      active: boolean | null
      endpoint: string | null
      expectedEndpoint: string
      matchesExpected: boolean | null
      ready: boolean
      status: 'ready' | 'use_webhook_disabled' | 'test_failed' | 'propagating' | 'verification_unavailable'
      test: Awaited<ReturnType<typeof testLineWebhookEndpoint>> | null
    } | null = null
    const webhookWarnings: string[] = []

    if (effectiveToken && webhookEndpoint) {
      let endpointInfo: Awaited<ReturnType<typeof getLineWebhookEndpointInfo>> | null = null
      let testResult: Awaited<ReturnType<typeof testLineWebhookEndpoint>> | null = null

      try {
        endpointInfo = await getLineWebhookEndpointInfo(effectiveToken)
      } catch {
        webhookWarnings.push('ตรวจสถานะ Webhook จาก LINE ไม่สำเร็จ')
      }

      try {
        testResult = await testLineWebhookEndpoint(effectiveToken, webhookEndpoint)
      } catch {
        webhookWarnings.push('ทดสอบ Webhook ผ่าน LINE ไม่สำเร็จ')
      }

      const matchesExpected = endpointInfo ? endpointInfo.endpoint === webhookEndpoint : null
      const ready = endpointInfo?.active === true && matchesExpected === true && testResult?.success === true
      const status = ready
        ? 'ready'
        : testResult?.success === false
          ? 'test_failed'
          : !testResult || !endpointInfo
            ? 'verification_unavailable'
            : testResult.success === true && endpointInfo.active === false && matchesExpected === true
            ? 'use_webhook_disabled'
              : matchesExpected === false
                ? 'propagating'
                : 'verification_unavailable'

      lineWebhook = {
        active: endpointInfo?.active ?? null,
        endpoint: endpointInfo?.endpoint ?? null,
        expectedEndpoint: webhookEndpoint,
        matchesExpected,
        ready,
        status,
        test: testResult,
      }
    }

    return NextResponse.json({
      bot: submittedBotInfo,
      lineWebhook,
      ok: true,
      syncWarning,
      webhookWarning: webhookWarnings.length > 0 ? webhookWarnings.join(' · ') : null,
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'บันทึกข้อมูลตั้งค่า LINE ไม่สำเร็จ', 400)
  }
}
