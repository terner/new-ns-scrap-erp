'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Copy, Link2, Plus, RefreshCw, Save, Send, Star, Zap } from 'lucide-react'
import { z } from 'zod'
import { ApiError, getErrorMessage, readJsonResponse } from '@/lib/api-client'

const targetSchema = z.object({
  active: z.boolean(),
  branchCode: z.string().nullable(),
  displayName: z.string().nullable(),
  id: z.string(),
  isDefault: z.boolean(),
  lastSeenAt: z.string().nullable(),
  sendWti: z.boolean(),
  sendWto: z.boolean(),
  targetId: z.string(),
  targetType: z.enum(['group', 'room', 'user']),
})

const payloadSchema = z.object({
  defaultWebhookUrl: z.string(),
  env: z.object({
    hasDefaultTargetId: z.boolean(),
    hasLineAccessToken: z.boolean(),
    hasLineChannelSecret: z.boolean(),
  }),
  recentEvents: z.array(z.object({
    eventType: z.string(),
    id: z.string(),
    receivedAt: z.string(),
    sourceId: z.string().nullable(),
    sourceType: z.string().nullable(),
  })),
  settings: z.object({
    accessTokenHint: z.string().nullable(),
    autoSendWti: z.boolean(),
    autoSendWto: z.boolean(),
    channelId: z.string().nullable(),
    channelSecretHint: z.string().nullable(),
    defaultTargetDbId: z.string().nullable(),
    hasAccessToken: z.boolean(),
    hasChannelSecret: z.boolean(),
    lastTestSentAt: z.string().nullable(),
    lastTokenVerifiedAt: z.string().nullable(),
    lastWebhookCheckedAt: z.string().nullable(),
    lastWebhookSetAt: z.string().nullable(),
    lastWebhookTestedAt: z.string().nullable(),
    pdfBucket: z.string(),
    webhookUrl: z.string().nullable(),
  }),
  targets: z.array(targetSchema),
})

const actionResponseSchema = z.object({
  result: z.unknown(),
  state: payloadSchema,
})

type LinePayload = z.infer<typeof payloadSchema>
type LineTarget = z.infer<typeof targetSchema>
type TargetType = LineTarget['targetType']

type SettingsForm = {
  autoSendWti: boolean
  autoSendWto: boolean
  channelAccessToken: string
  channelId: string
  channelSecret: string
  defaultTargetDbId: string
  pdfBucket: string
  webhookUrl: string
}

type ManualTargetForm = {
  displayName: string
  targetId: string
  targetType: TargetType
}

const emptyForm: SettingsForm = {
  autoSendWti: false,
  autoSendWto: false,
  channelAccessToken: '',
  channelId: '',
  channelSecret: '',
  defaultTargetDbId: '',
  pdfBucket: 'weight-ticket-pdfs',
  webhookUrl: '',
}

const emptyTargetForm: ManualTargetForm = {
  displayName: '',
  targetId: '',
  targetType: 'group',
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('th-TH', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  })
}

function targetTypeLabel(type: TargetType) {
  if (type === 'group') return 'กลุ่ม'
  if (type === 'room') return 'ห้อง'
  return 'ผู้ใช้'
}

function payloadToForm(payload: LinePayload): SettingsForm {
  return {
    autoSendWti: payload.settings.autoSendWti,
    autoSendWto: payload.settings.autoSendWto,
    channelAccessToken: '',
    channelId: payload.settings.channelId ?? '',
    channelSecret: '',
    defaultTargetDbId: payload.settings.defaultTargetDbId ?? '',
    pdfBucket: payload.settings.pdfBucket,
    webhookUrl: payload.settings.webhookUrl ?? payload.defaultWebhookUrl,
  }
}

function resultText(result: unknown) {
  if (!result) return ''
  if (typeof result === 'string') return result
  return JSON.stringify(result, null, 2)
}

export function LineSettingsPageClient() {
  const [data, setData] = useState<LinePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({})
  const [form, setForm] = useState<SettingsForm>(emptyForm)
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [manualTarget, setManualTarget] = useState<ManualTargetForm>(emptyTargetForm)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const defaultTarget = useMemo(() => data?.targets.find((target) => target.id === form.defaultTargetDbId) ?? data?.targets.find((target) => target.isDefault) ?? null, [data?.targets, form.defaultTargetDbId])
  const hasFallbackTestTargets = useMemo(() => data?.targets.some((target) => target.active && target.targetType === 'group') ?? false, [data?.targets])

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/line-settings', { cache: 'no-store' })
      const payload = await readJsonResponse(response, payloadSchema, 'โหลดตั้งค่า LINE ไม่สำเร็จ')
      setData(payload)
      setForm(payloadToForm(payload))
      setFieldErrors({})
    } catch (caught) {
      setError(getErrorMessage(caught, 'โหลดตั้งค่า LINE ไม่สำเร็จ'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function update<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: undefined }))
    setMessage(null)
  }

  function updateManualTarget<K extends keyof ManualTargetForm>(key: K, value: ManualTargetForm[K]) {
    setManualTarget((current) => ({ ...current, [key]: value }))
    setMessage(null)
  }

  async function save() {
    setError(null)
    setMessage(null)
    setPendingAction('save')
    try {
      const response = await fetch('/api/admin/line-settings', {
        body: JSON.stringify(form),
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      })
      const payload = await readJsonResponse(response, payloadSchema, 'บันทึกตั้งค่า LINE ไม่สำเร็จ')
      setData(payload)
      setForm(payloadToForm(payload))
      setFieldErrors({})
      setMessage('บันทึกตั้งค่า LINE แล้ว')
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(Object.fromEntries(Object.entries(caught.fieldErrors).map(([key, value]) => [key, value?.[0] ?? 'ข้อมูลไม่ถูกต้อง'])))
      }
      setError(getErrorMessage(caught, 'บันทึกตั้งค่า LINE ไม่สำเร็จ'))
    } finally {
      setPendingAction(null)
    }
  }

  async function runAction(action: 'verify-token' | 'set-webhook' | 'get-webhook' | 'test-webhook' | 'send-test') {
    setError(null)
    setMessage(null)
    setPendingAction(action)
    try {
      const response = await fetch('/api/admin/line-settings/actions', {
        body: JSON.stringify({
          action,
          endpoint: form.webhookUrl,
          targetId: defaultTarget?.targetId,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const payload = await readJsonResponse(response, actionResponseSchema, 'สั่งงาน LINE ไม่สำเร็จ')
      setData(payload.state)
      setForm(payloadToForm(payload.state))
      setMessage(resultText(payload.result) || 'สั่งงานสำเร็จ')
    } catch (caught) {
      setError(getErrorMessage(caught, 'สั่งงาน LINE ไม่สำเร็จ'))
    } finally {
      setPendingAction(null)
    }
  }

  async function saveTarget(target: LineTarget, overrides: Partial<LineTarget> = {}) {
    setError(null)
    setMessage(null)
    setPendingAction(`target-${target.id}`)
    try {
      const response = await fetch('/api/admin/line-settings/targets', {
        body: JSON.stringify({
          ...target,
          ...overrides,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const payload = await readJsonResponse(response, payloadSchema, 'บันทึก LINE target ไม่สำเร็จ')
      setData(payload)
      setForm(payloadToForm(payload))
      setMessage('บันทึก LINE target แล้ว')
    } catch (caught) {
      setError(getErrorMessage(caught, 'บันทึก LINE target ไม่สำเร็จ'))
    } finally {
      setPendingAction(null)
    }
  }

  async function addManualTarget() {
    setError(null)
    setMessage(null)
    setPendingAction('add-target')
    try {
      const response = await fetch('/api/admin/line-settings/targets', {
        body: JSON.stringify({
          active: true,
          displayName: manualTarget.displayName,
          isDefault: data?.targets.length === 0,
          sendWti: true,
          sendWto: true,
          targetId: manualTarget.targetId,
          targetType: manualTarget.targetType,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const payload = await readJsonResponse(response, payloadSchema, 'เพิ่ม LINE target ไม่สำเร็จ')
      setData(payload)
      setForm(payloadToForm(payload))
      setManualTarget(emptyTargetForm)
      setMessage('เพิ่ม LINE target แล้ว')
    } catch (caught) {
      setError(getErrorMessage(caught, 'เพิ่ม LINE target ไม่สำเร็จ'))
    } finally {
      setPendingAction(null)
    }
  }

  async function copyWebhookUrl() {
    await navigator.clipboard.writeText(form.webhookUrl || data?.defaultWebhookUrl || '')
    setMessage('คัดลอก webhook URL แล้ว')
  }

  const disabled = Boolean(pendingAction) || isLoading

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">ตั้งค่า LINE</h1>
            <p className="mt-1 text-sm text-slate-600">บันทึก token, ตั้ง webhook, เลือกกลุ่มปลายทาง และทดสอบส่งจากหน้านี้ได้เลย</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={disabled} type="button" onClick={() => void loadData()}>
              <RefreshCw className="h-4 w-4" /> รีเฟรช
            </button>
            <button className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={disabled} type="button" onClick={() => void save()}>
              <Save className="h-4 w-4" /> {pendingAction === 'save' ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
      {message ? <pre className="max-h-52 overflow-auto rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 whitespace-pre-wrap">{message}</pre> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">1. Channel</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <TextField error={fieldErrors.channelId} label="Channel ID" value={form.channelId} onChange={(value) => update('channelId', value)} />
              <TextField error={fieldErrors.pdfBucket} label="PDF bucket" value={form.pdfBucket} onChange={(value) => update('pdfBucket', value)} />
              <TextField
                className="md:col-span-2"
                error={fieldErrors.channelAccessToken}
                hint={data?.settings.accessTokenHint ? `มีค่าเดิม: ${data.settings.accessTokenHint}` : data?.env.hasLineAccessToken ? 'มีค่าใน env แล้ว' : undefined}
                label="Channel access token"
                placeholder="เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน"
                type="password"
                value={form.channelAccessToken}
                onChange={(value) => update('channelAccessToken', value)}
              />
              <TextField
                className="md:col-span-2"
                error={fieldErrors.channelSecret}
                hint={data?.settings.channelSecretHint ? `มีค่าเดิม: ${data.settings.channelSecretHint}` : data?.env.hasLineChannelSecret ? 'มีค่าใน env แล้ว' : undefined}
                label="Channel secret"
                placeholder="เว้นว่างไว้ถ้าไม่ต้องการเปลี่ยน"
                type="password"
                value={form.channelSecret}
                onChange={(value) => update('channelSecret', value)}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="inline-flex h-9 items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60" disabled={disabled || !data?.settings.hasAccessToken} type="button" onClick={() => void runAction('verify-token')}>
                <CheckCircle2 className="h-4 w-4" /> ตรวจ token
              </button>
              <div className="text-xs text-slate-500 self-center">ตรวจล่าสุด: {formatDateTime(data?.settings.lastTokenVerifiedAt ?? null)}</div>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">2. Webhook</h2>
            <div className="mt-3 grid gap-3">
              <TextField error={fieldErrors.webhookUrl} label="Webhook URL ที่จะส่งให้ LINE" value={form.webhookUrl} onChange={(value) => update('webhookUrl', value)} />
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={!form.webhookUrl} type="button" onClick={() => void copyWebhookUrl()}>
                  <Copy className="h-4 w-4" /> คัดลอก
                </button>
                <button className="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60" disabled={disabled || !data?.settings.hasAccessToken} type="button" onClick={() => void runAction('set-webhook')}>
                  <Link2 className="h-4 w-4" /> ตั้ง webhook ให้ LINE
                </button>
                <button className="inline-flex h-9 items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-60" disabled={disabled || !data?.settings.hasAccessToken} type="button" onClick={() => void runAction('get-webhook')}>
                  <RefreshCw className="h-4 w-4" /> เช็ค webhook
                </button>
                <button className="inline-flex h-9 items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60" disabled={disabled || !data?.settings.hasAccessToken} type="button" onClick={() => void runAction('test-webhook')}>
                  <Zap className="h-4 w-4" /> ทดสอบ webhook
                </button>
              </div>
              <div className="grid gap-2 text-xs text-slate-500 md:grid-cols-3">
                <div>ตั้งล่าสุด: {formatDateTime(data?.settings.lastWebhookSetAt ?? null)}</div>
                <div>เช็คล่าสุด: {formatDateTime(data?.settings.lastWebhookCheckedAt ?? null)}</div>
                <div>ทดสอบล่าสุด: {formatDateTime(data?.settings.lastWebhookTestedAt ?? null)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">3. ส่งใบรับ-ส่งของ</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
                <input checked={form.autoSendWti} className="mt-1" type="checkbox" onChange={(event) => update('autoSendWti', event.target.checked)} />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">ส่งอัตโนมัติเมื่อจบ WTI</span>
                  <span className="block text-xs text-slate-500">ใบรับของจะใช้ target หลักด้านล่าง</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3">
                <input checked={form.autoSendWto} className="mt-1" type="checkbox" onChange={(event) => update('autoSendWto', event.target.checked)} />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">ส่งอัตโนมัติเมื่อจบ WTO</span>
                  <span className="block text-xs text-slate-500">ใบส่งของจะใช้ target หลักด้านล่าง</span>
                </span>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={disabled || (!defaultTarget && !hasFallbackTestTargets)} type="button" onClick={() => void runAction('send-test')}>
                <Send className="h-4 w-4" /> ส่งข้อความทดสอบ
              </button>
              <div className="text-xs text-slate-500">target หลัก: {defaultTarget?.displayName || defaultTarget?.targetId || 'ไม่ได้เลือก จะส่งทุกกลุ่ม active ที่พบจาก webhook'} · ส่งล่าสุด: {formatDateTime(data?.settings.lastTestSentAt ?? null)}</div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">LINE targets</h2>
            <p className="mt-1 text-xs text-slate-500">หลังตั้ง webhook แล้ว ให้มี event จาก LINE เข้ามา target จะขึ้นตรงนี้ ถ้าไม่ตั้งกลุ่มหลัก ระบบจะส่งทุกกลุ่ม active ที่ตรง WTI/WTO/สาขา</p>
            <div className="mt-3 space-y-2">
              {data?.targets.length ? data.targets.map((target) => (
                <div className={`rounded-md border p-3 ${target.isDefault ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`} key={target.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900">{target.displayName || target.targetId}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{targetTypeLabel(target.targetType)} · {target.targetId}</div>
                      <div className="mt-0.5 text-xs text-slate-500">เห็นล่าสุด: {formatDateTime(target.lastSeenAt)}</div>
                    </div>
                    {target.isDefault ? <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">หลัก</span> : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={disabled || target.isDefault} type="button" onClick={() => void saveTarget(target, { active: true, isDefault: true })}>
                      <Star className="h-3.5 w-3.5" /> ตั้งหลัก
                    </button>
                    <button className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60" disabled={disabled} type="button" onClick={() => void saveTarget(target, { active: !target.active, isDefault: target.active ? false : target.isDefault })}>
                      {target.active ? 'ปิดใช้' : 'เปิดใช้'}
                    </button>
                  </div>
                </div>
              )) : <div className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">ยังไม่มี target จาก webhook</div>}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">เพิ่ม target เอง</h2>
            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-slate-700">ประเภท</span>
                <select className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={manualTarget.targetType} onChange={(event) => updateManualTarget('targetType', event.target.value as TargetType)}>
                  <option value="group">กลุ่ม</option>
                  <option value="room">ห้อง</option>
                  <option value="user">ผู้ใช้</option>
                </select>
              </label>
              <TextField label="ชื่อที่แสดง" value={manualTarget.displayName} onChange={(value) => updateManualTarget('displayName', value)} />
              <TextField label="Target ID" value={manualTarget.targetId} onChange={(value) => updateManualTarget('targetId', value)} />
              <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={disabled || !manualTarget.targetId.trim()} type="button" onClick={() => void addManualTarget()}>
                <Plus className="h-4 w-4" /> เพิ่ม target
              </button>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Webhook ล่าสุด</h2>
            <div className="mt-3 space-y-2 text-sm">
              {data?.recentEvents.length ? data.recentEvents.map((event) => (
                <div className="rounded-md border border-slate-200 p-2" key={event.id}>
                  <div className="font-semibold text-slate-800">{event.eventType}</div>
                  <div className="text-xs text-slate-500">{event.sourceType ?? '-'} · {event.sourceId ?? '-'}</div>
                  <div className="text-xs text-slate-500">{formatDateTime(event.receivedAt)}</div>
                </div>
              )) : <div className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">ยังไม่มี webhook event</div>}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

function TextField({
  className,
  error,
  hint,
  label,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  className?: string
  error?: string
  hint?: string
  label: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  value: string
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-bold text-slate-700">{label}</span>
      <input className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-slate-700 focus:outline-none focus:ring-0" placeholder={placeholder} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  )
}
