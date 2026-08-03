import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import {
  deriveLineWebhookEndpoint,
  getLineWebhookEndpointInfo,
  setLineWebhookEndpoint,
  testLineWebhookEndpoint,
} from '@/lib/server/line-webhook-settings'
import { acquireLineCredentialWriteLock } from '@/lib/server/line-credential-lock'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'system.settings.manage')

    const result = await prisma.$transaction(async (transaction) => {
      await acquireLineCredentialWriteLock(transaction)

    const settings = await transaction.system_settings.findMany({
      where: { key: { in: ['LINE_CHANNEL_ACCESS_TOKEN', 'NEXT_PUBLIC_APP_URL'] } },
    })
    const config = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]))
    const token = config.LINE_CHANNEL_ACCESS_TOKEN || ''
    if (!token) {
      throw new Error('กรุณากรอกและบันทึก LINE Channel Access Token ก่อนทดสอบ')
    }

    const expectedEndpoint = deriveLineWebhookEndpoint(
      config.NEXT_PUBLIC_APP_URL || new URL(request.url).origin,
    )

    await setLineWebhookEndpoint(token, expectedEndpoint)
    let endpointInfo: Awaited<ReturnType<typeof getLineWebhookEndpointInfo>> | null = null
    let warning: string | null = null
    try {
      endpointInfo = await getLineWebhookEndpointInfo(token)
    } catch (caught) {
      warning = caught instanceof Error ? caught.message : 'ตรวจสถานะ Webhook จาก LINE ไม่สำเร็จ'
    }
    const test = await testLineWebhookEndpoint(token, expectedEndpoint)
    const matchesExpected = endpointInfo ? endpointInfo.endpoint === expectedEndpoint : null
    const ready = endpointInfo?.active === true && matchesExpected === true && test.success
    const status = ready
      ? 'ready'
      : !test.success
        ? 'test_failed'
        : !endpointInfo
          ? 'verification_unavailable'
          : matchesExpected !== true
            ? 'propagating'
            : 'use_webhook_disabled'

    const message = ready
      ? 'LINE ทดสอบ Webhook สำเร็จ และเปิด Use webhook แล้ว'
      : status === 'use_webhook_disabled'
        ? 'ตั้ง URL และทดสอบ Webhook สำเร็จแล้ว กรุณาเปิด Use webhook ใน LINE Developers Console หนึ่งครั้ง'
        : status === 'verification_unavailable'
          ? 'ตั้ง URL และทดสอบ endpoint สำเร็จ แต่ยังตรวจสถานะ Use webhook จาก LINE ไม่ได้ กรุณากดตรวจอีกครั้ง'
        : status === 'propagating'
          ? 'LINE รายงาน URL ยังไม่ตรงกับค่าที่ตั้งล่าสุด กรุณากดตรวจอีกครั้ง'
          : `LINE ทดสอบ Webhook ไม่สำเร็จ (${test.statusCode || '-'} ${test.reason || ''})`.trim()

    return {
      active: endpointInfo?.active ?? null,
      endpoint: endpointInfo?.endpoint ?? null,
      expectedEndpoint,
      matchesExpected,
      message,
      ok: test.success,
      ready,
      status,
      test,
      warning,
    }
    }, { maxWait: 5_000, timeout: 30_000 })

    return NextResponse.json(result)
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'ตั้งค่าและทดสอบ Webhook ผ่าน LINE ไม่สำเร็จ', 400)
  }
}
