'use client'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { z } from 'zod'
import { ApiError, getErrorMessage, readJsonResponse } from '@/lib/api-client'
import { useResizableColumns, type ResizableColumnDefinition } from '@/components/ui/useResizableColumns'
import { ResizableTableHead } from '@/components/ui/ResizableTableHead'

const settingsSchema = z.object({
  lineChannelAccessToken: z.string().trim().nullable().or(z.literal('')),
  lineChannelSecret: z.string().trim().nullable().or(z.literal('')),
  lineDefaultTargetId: z.string().trim().nullable().or(z.literal('')),
  pdfBucket: z.string().trim().min(1, 'กรุณาระบุชื่อ Storage Bucket'),
  appUrl: z.string().trim().url('รูปแบบ URL ไม่ถูกต้อง').or(z.literal('')),
  lineAutoSendWti: z.boolean().default(false),
  lineAutoSendWto: z.boolean().default(false),
  googleSheetsWebhookUrl: z.string().trim().url('รูปแบบ URL ไม่ถูกต้อง').or(z.literal('')).nullable().or(z.literal('')),
})

type SettingsFormValues = z.infer<typeof settingsSchema>
type FieldErrors = Partial<Record<keyof SettingsFormValues, string>>

type LineGroup = {
  groupId: string
  name: string
  pictureUrl: string | null
  branchCode: string | null
  notifyWti: boolean
  notifyWto: boolean
  isActive: boolean
}

type BranchOption = {
  id: string
  name: string
  code: string | null
}

const emptySettings: SettingsFormValues = {
  lineChannelAccessToken: '',
  lineChannelSecret: '',
  lineDefaultTargetId: '',
  pdfBucket: 'weight-ticket-pdfs',
  appUrl: '',
  lineAutoSendWti: false,
  lineAutoSendWto: false,
  googleSheetsWebhookUrl: '',
}

type GroupRoutingColumnKey = 'groupInfo' | 'branchCode' | 'notifyWti' | 'notifyWto' | 'isActive' | 'actions'

const groupRoutingColumns: Array<ResizableColumnDefinition<GroupRoutingColumnKey>> = [
  { key: 'groupInfo', defaultWidth: 240, minWidth: 160 },
  { key: 'branchCode', defaultWidth: 200, minWidth: 140 },
  { key: 'notifyWti', defaultWidth: 100, minWidth: 80 },
  { key: 'notifyWto', defaultWidth: 100, minWidth: 80 },
  { key: 'isActive', defaultWidth: 120, minWidth: 90 },
  { key: 'actions', defaultWidth: 110, minWidth: 90 },
]

export function LineSettingsPageClient() {
  const [form, setForm] = useState<SettingsFormValues>(emptySettings)
  const [groups, setGroups] = useState<LineGroup[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [savingGroupIds, setSavingGroupIds] = useState<Record<string, boolean>>({})
  const [isManualInput, setIsManualInput] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isTestingOA, setIsTestingOA] = useState(false)
  const [isTestingWebhook, setIsTestingWebhook] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [message, setMessage] = useState<string | null>(null)

  // Password visibility states
  const [showToken, setShowToken] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      // 1. Fetch branches
      try {
        const branchRes = await fetch('/api/branches', { cache: 'no-store' })
        if (branchRes.ok) {
          const branchData = await branchRes.json()
          setBranches(branchData.branches || [])
        }
      } catch (err) {
        console.error('Failed to load branches list', err)
      }

      // 2. Fetch settings
      const response = await fetch('/api/admin/line-settings', { cache: 'no-store' })
      const payload = await readJsonResponse(response, settingsSchema, 'โหลดข้อมูลตั้งค่า LINE ไม่สำเร็จ')
      setForm(payload)

      // 3. Fetch groups
      let fetchedGroups: LineGroup[] = []
      try {
        const groupsRes = await fetch('/api/admin/line-groups', { cache: 'no-store' })
        if (groupsRes.ok) {
          const groupsData = await groupsRes.json()
          fetchedGroups = groupsData.groups || []
          setGroups(fetchedGroups)
        }
      } catch (err) {
        console.error('Failed to load line groups list', err)
      }

      // 4. Determine if current target ID requires manual input mode
      const currentTarget = payload.lineDefaultTargetId
      const isKnownGroup = fetchedGroups.some((g) => g.groupId === currentTarget)
      if (currentTarget && !isKnownGroup) {
        setIsManualInput(true)
      } else {
        setIsManualInput(false)
      }

      setFieldErrors({})
    } catch (caught) {
      setError(getErrorMessage(caught, 'โหลดข้อมูลตั้งค่า LINE ไม่สำเร็จ'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function update<K extends keyof SettingsFormValues>(key: K, value: SettingsFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: undefined }))
    setMessage(null)
  }

  async function save() {
    setError(null)
    setMessage(null)
    setFieldErrors({})

    const parsed = settingsSchema.safeParse(form)

    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as FieldErrors)
      setError('กรุณาตรวจสอบความถูกต้องของข้อมูล')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/line-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || body.message || 'การตอบสนองจากเซิร์ฟเวอร์ผิดพลาด')
      }

      setMessage('บันทึกข้อมูลการตั้งค่า LINE สำเร็จ')
      setFieldErrors({})
    } catch (caught) {
      if (caught instanceof ApiError && caught.fieldErrors) {
        setFieldErrors(
          Object.fromEntries(
            Object.entries(caught.fieldErrors).map(([key, val]) => [key, val?.[0] ?? 'ข้อมูลไม่ถูกต้อง'])
          ) as FieldErrors
        )
      }
      setError(getErrorMessage(caught, 'บันทึกข้อมูลตั้งค่า LINE ไม่สำเร็จ'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTestSend() {
    setError(null)
    setMessage(null)

    if (!form.lineChannelAccessToken) {
      setError('กรุณากรอก LINE Channel Access Token ก่อนทดสอบ')
      return
    }


    setIsTesting(true)
    try {
      const res = await fetch('/api/admin/line-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: form.lineChannelAccessToken,
          targetId: form.lineDefaultTargetId,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || body.message || 'การตอบสนองจากเซิร์ฟเวอร์ผิดพลาด')
      }

      setMessage('🚀 ส่งข้อความทดสอบไปยัง LINE สำเร็จแล้ว! กรุณาเช็คในห้องแชทกลุ่ม LINE ของคุณ')
    } catch (caught) {
      setError(getErrorMessage(caught, 'ส่งข้อความทดสอบไม่สำเร็จ'))
    } finally {
      setIsTesting(false)
    }
  }

  async function testOAConnection() {
    setError(null)
    setMessage(null)

    if (!form.lineChannelAccessToken) {
      setError('กรุณากรอก LINE Channel Access Token ก่อนทดสอบ')
      return
    }

    setIsTestingOA(true)
    try {
      const res = await fetch('/api/admin/line-settings/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: form.lineChannelAccessToken,
        }),
      })

      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(body.error || body.message || 'การตอบสนองจากเซิร์ฟเวอร์ผิดพลาด')
      }

      setMessage(`🔌 เชื่อมต่อ LINE OA สำเร็จ! บอทของคุณชื่อ "${body.botName}" (${body.basicId})`)
    } catch (caught) {
      setError(getErrorMessage(caught, 'ตรวจสอบการเชื่อมต่อ LINE OA ล้มเหลว'))
    } finally {
      setIsTestingOA(false)
    }
  }

  async function testWebhookSimulation() {
    setError(null)
    setMessage(null)

    if (!form.lineChannelSecret) {
      setError('กรุณากรอก LINE Channel Secret ก่อนทดสอบ')
      return
    }

    setIsTestingWebhook(true)
    try {
      const res = await fetch('/api/admin/line-settings/test-webhook', {
        method: 'POST',
      })

      const body = await res.json().catch(() => ({}))

      if (!res.ok || body.ok === false) {
        throw new Error(body.message || body.error || 'การตอบสนองจากเซิร์ฟเวอร์ผิดพลาด')
      }

      setMessage(`✅ ${body.message}`)
    } catch (caught) {
      setError(getErrorMessage(caught, 'ทดสอบจำลอง Webhook ล้มเหลว'))
    } finally {
      setIsTestingWebhook(false)
    }
  }

  const handleGroupSelect = (val: string) => {
    setMessage(null)
    if (val === 'manual') {
      setIsManualInput(true)
    } else {
      setIsManualInput(false)
      update('lineDefaultTargetId', val)
    }
  }

  // Determine current dropdown value
  const selectedDropdownValue = isManualInput
    ? 'manual'
    : form.lineDefaultTargetId && groups.some((g) => g.groupId === form.lineDefaultTargetId)
    ? form.lineDefaultTargetId
    : form.lineDefaultTargetId
    ? 'manual'
    : ''

  // Local group update helper
  const updateGroupLocal = useCallback(<K extends keyof LineGroup>(groupId: string, key: K, value: LineGroup[K]) => {
    setGroups((current) => current.map((g) => (g.groupId === groupId ? { ...g, [key]: value } : g)))
  }, [])

  // Group update PATCH save handler
  async function handleUpdateGroupRouting(groupId: string, updates: Partial<LineGroup>) {
    setMessage(null)
    setError(null)
    setSavingGroupIds((curr) => ({ ...curr, [groupId]: true }))
    try {
      const group = groups.find((g) => g.groupId === groupId)
      if (!group) return

      const payload = {
        groupId,
        branchCode: updates.branchCode !== undefined ? updates.branchCode : group.branchCode,
        notifyWti: updates.notifyWti !== undefined ? updates.notifyWti : group.notifyWti,
        notifyWto: updates.notifyWto !== undefined ? updates.notifyWto : group.notifyWto,
        isActive: updates.isActive !== undefined ? updates.isActive : group.isActive,
      }

      const response = await fetch('/api/admin/line-groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'อัปเดตการตั้งค่ากลุ่มล้มเหลว')
      }

      const updatedGroup = await response.json()
      setGroups((curr) =>
        curr.map((g) =>
          g.groupId === groupId
            ? {
                ...g,
                branchCode: updatedGroup.branchCode,
                notifyWti: updatedGroup.notifyWti,
                notifyWto: updatedGroup.notifyWto,
                isActive: updatedGroup.isActive,
              }
            : g
        )
      )
      setMessage('อัปเดตการตั้งค่าของกลุ่มสำเร็จ')
    } catch (caught) {
      setError(getErrorMessage(caught, 'อัปเดตการตั้งค่าของกลุ่มไม่สำเร็จ'))
    } finally {
      setSavingGroupIds((curr) => ({ ...curr, [groupId]: false }))
    }
  }

  // Sorting state for LINE Group Routing
  const [groupSortBy, setGroupSortBy] = useState<'name' | 'branchCode' | 'isActive'>('name')
  const [groupSortDir, setGroupSortDir] = useState<'asc' | 'desc'>('asc')

  const handleGroupSort = (key: 'name' | 'branchCode' | 'isActive') => {
    if (groupSortBy === key) {
      setGroupSortDir((curr) => (curr === 'asc' ? 'desc' : 'asc'))
    } else {
      setGroupSortBy(key)
      setGroupSortDir('asc')
    }
  }

  const sortedGroups = useMemo(() => {
    return [...groups].sort((left, right) => {
      let leftVal: string = ''
      let rightVal: string = ''
      if (groupSortBy === 'name') {
        leftVal = left.name || ''
        rightVal = right.name || ''
      } else if (groupSortBy === 'branchCode') {
        leftVal = left.branchCode || ''
        rightVal = right.branchCode || ''
      } else if (groupSortBy === 'isActive') {
        leftVal = left.isActive ? '1' : '0'
        rightVal = right.isActive ? '1' : '0'
      }
      const cmp = leftVal.localeCompare(rightVal, 'th', { numeric: true })
      return groupSortDir === 'asc' ? cmp : -cmp
    })
  }, [groups, groupSortBy, groupSortDir])

  const groupResize = useResizableColumns('admin.line-settings.group-routing-v3', groupRoutingColumns)

  return (
    <section className="space-y-4 max-w-6xl mx-auto p-4 lg:p-6 animate-fade-in">
      {/* Page Header */}
      <div className="rounded-xl bg-slate-900 p-5 text-white shadow-md">
        <h1 className="text-xl font-bold">⚙️ ตั้งค่า LINE Notification</h1>
        <p className="mt-1 text-sm text-slate-400">
          ตั้งค่าการเชื่อมต่อ LINE Messaging API และการจัดการเอกสาร PDF สำหรับส่งใบแจ้งเตือนน้ำหนัก (Weight Ticket)
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 animate-fade-in flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 animate-fade-in flex items-center gap-2">
          <span>✅</span>
          <span>{message}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <div className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500 space-y-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            <p className="text-sm">กำลังโหลดข้อมูลตั้งค่าระบบ...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Section 1: LINE Messaging API */}
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <span className="text-lg">💬</span> LINE Messaging API Credentials
              </h2>

              <div className="space-y-4">
                {/* Channel Access Token */}
                <div className="space-y-1">
                  <label className="block text-sm font-bold text-slate-700">
                    LINE Channel Access Token
                  </label>
                  <div className="relative flex items-stretch">
                    <input
                      className="w-full rounded-lg border border-slate-350 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-700 focus:outline-none focus:ring-0 pr-10 h-10"
                      type={showToken ? 'text' : 'password'}
                      placeholder="ป้อน Channel Access Token ยาวๆ ของบอทไลน์"
                      value={form.lineChannelAccessToken ?? ''}
                      onChange={(e) => update('lineChannelAccessToken', e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? '🐵' : '🙈'}
                    </button>
                  </div>

                  {/* ปุ่มทดสอบเชื่อมต่อ LINE OA */}
                  <div className="pt-1">
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs font-semibold text-[#0284c7] border border-[#bae6fd] hover:bg-[#f0f9ff] rounded-lg transition focus:outline-none h-8 flex items-center gap-1 disabled:opacity-60"
                      onClick={() => void testOAConnection()}
                      disabled={isLoading || isSaving || isTesting || isTestingOA}
                    >
                      {isTestingOA ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#7dd3fc] border-t-[#0284c7]" />
                          <span>กำลังตรวจสอบ...</span>
                        </>
                      ) : (
                        <span>🔌 ทดสอบเชื่อมต่อ LINE OA</span>
                      )}
                    </button>
                  </div>

                  {fieldErrors.lineChannelAccessToken ? (
                    <p className="text-xs text-red-600">{fieldErrors.lineChannelAccessToken}</p>
                  ) : null}
                  <p className="text-xs text-slate-400">
                    ใช้เพื่อลงลายมือชื่อในการเรียกใช้งาน LINE API (Channel Access Token v4 หรือ Long-lived)
                  </p>
                </div>

                {/* Channel Secret */}
                <div className="space-y-1">
                  <label className="block text-sm font-bold text-slate-700">
                    LINE Channel Secret
                  </label>
                  <div className="relative flex items-stretch">
                    <input
                      className="w-full rounded-lg border border-slate-350 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-700 focus:outline-none focus:ring-0 pr-10 h-10"
                      type={showSecret ? 'text' : 'password'}
                      placeholder="ป้อน Channel Secret ของ LINE App"
                      value={form.lineChannelSecret ?? ''}
                      onChange={(e) => update('lineChannelSecret', e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? '🐵' : '🙈'}
                    </button>
                  </div>

                  {/* ปุ่มทดสอบจำลอง Webhook */}
                  <div className="pt-1">
                    <button
                      type="button"
                      className="px-3 py-1.5 text-xs font-semibold text-[#0284c7] border border-[#bae6fd] hover:bg-[#f0f9ff] rounded-lg transition focus:outline-none h-8 flex items-center gap-1 disabled:opacity-60"
                      onClick={() => void testWebhookSimulation()}
                      disabled={isLoading || isSaving || isTesting || isTestingOA || isTestingWebhook}
                    >
                      {isTestingWebhook ? (
                        <>
                          <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#7dd3fc] border-t-[#0284c7]" />
                          <span>กำลังจำลองส่ง...</span>
                        </>
                      ) : (
                        <span>🔌 ทดสอบจำลอง Webhook (ขารับ)</span>
                      )}
                    </button>
                  </div>

                  {fieldErrors.lineChannelSecret ? (
                    <p className="text-xs text-red-600">{fieldErrors.lineChannelSecret}</p>
                  ) : null}
                  <p className="text-xs text-slate-400">
                    ใช้สำหรับตรวจสอบความถูกต้องของ Signature จาก Webhook Payload
                  </p>
                </div>

                {/* Default Target ID (Selector & Manual Input) */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-700">
                    LINE Default Target ID (กลุ่มส่งข้อมูลเริ่มต้น)
                  </label>

                  {/* Dropdown list of groups */}
                  <select
                    className="w-full rounded-lg border border-slate-350 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-700 focus:outline-none focus:ring-0 h-10"
                    value={selectedDropdownValue}
                    onChange={(e) => handleGroupSelect(e.target.value)}
                  >
                    <option value="">-- เลือกกลุ่มไลน์รับการแจ้งเตือน --</option>
                    {groups.map((group) => (
                      <option key={group.groupId} value={group.groupId}>
                        👥 {group.name} ({group.groupId.slice(0, 10)}...)
                      </option>
                    ))}
                    <option value="manual">⚙️ ระบุไอดีเองแบบกำหนดเอง (Manual Input)</option>
                  </select>

                  {/* Manual text input if chosen or not in list */}
                  {isManualInput ? (
                    <div className="mt-2 space-y-1 animate-fade-in">
                      <input
                        className="w-full rounded-lg border border-slate-350 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-700 focus:outline-none focus:ring-0 h-10"
                        type="text"
                        placeholder="กรอก Group ID หรือ User ID ปลายทาง เช่น C12345abcdef..."
                        value={form.lineDefaultTargetId ?? ''}
                        onChange={(e) => update('lineDefaultTargetId', e.target.value)}
                      />
                      <p className="text-xs text-amber-600">
                        * ป้อน Group ID ปลายทางโดยตรง (ตัวอักษรขึ้นต้นด้วย C หรือ U)
                      </p>
                    </div>
                  ) : null}

                  {fieldErrors.lineDefaultTargetId ? (
                    <p className="text-xs text-red-600">{fieldErrors.lineDefaultTargetId}</p>
                  ) : null}

                  <p className="text-xs text-slate-400">
                    กลุ่มไลน์เริ่มต้นสำหรับรับแจ้งเตือน (รายชื่อกลุ่มจะบันทึกเข้าตารางอัตโนมัติเมื่อดึงบอทเข้ากลุ่มใหม่)
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Storage and App Config */}
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <span className="text-lg">📁</span> Storage & Application Settings
              </h2>

              <div className="space-y-4">
                {/* PDF Storage Bucket */}
                <div className="space-y-1">
                  <label className="block text-sm font-bold text-slate-700">
                    Weight Ticket PDF Bucket Name *
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-350 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-700 focus:outline-none focus:ring-0 h-10"
                    type="text"
                    placeholder="เช่น weight-ticket-pdfs"
                    value={form.pdfBucket}
                    onChange={(e) => update('pdfBucket', e.target.value)}
                  />
                  {fieldErrors.pdfBucket ? (
                    <p className="text-xs text-red-600">{fieldErrors.pdfBucket}</p>
                  ) : null}
                  <p className="text-xs text-slate-400">
                    ชื่อ Bucket บน Supabase Storage สำหรับเก็บไฟล์ใบชั่งน้ำหนัก PDF ที่จะใช้เปิดผ่าน Link ใน LINE
                  </p>
                </div>

                {/* App URL */}
                <div className="space-y-1">
                  <label className="block text-sm font-bold text-slate-700">
                    Application URL (App URL)
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-350 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-700 focus:outline-none focus:ring-0 h-10"
                    type="url"
                    placeholder="เช่น https://new-ns-scrap-erp.vercel.app"
                    value={form.appUrl ?? ''}
                    onChange={(e) => update('appUrl', e.target.value)}
                  />
                  {fieldErrors.appUrl ? (
                    <p className="text-xs text-red-600">{fieldErrors.appUrl}</p>
                  ) : null}
                  <p className="text-xs text-slate-400">
                    URL ของหน้าเว็บแอพนี้ เพื่อใช้ประกอบเป็น Link ส่งไปในข้อความ LINE ให้กดเปิดดูใบ PDF ชั่งน้ำหนัก
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3: Notification Automation & Data Streams */}
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <span className="text-lg">🤖</span> Automation & Data Streams
              </h2>

              <div className="space-y-4">
                {/* Auto Send Toggles */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-5 items-center">
                      <input
                        id="lineAutoSendWti"
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-[#0F172A] focus:ring-0 cursor-pointer"
                        checked={form.lineAutoSendWti}
                        onChange={(e) => update('lineAutoSendWti', e.target.checked)}
                      />
                    </div>
                    <div className="text-sm">
                      <label htmlFor="lineAutoSendWti" className="font-bold text-slate-700 cursor-pointer">
                        ส่งใบรับของ WTI อัตโนมัติ (Auto-Send WTI)
                      </label>
                      <p className="text-xs text-slate-400">
                        เมื่อสร้างใบรับของ WTI สำเร็จ ระบบจะส่งแจ้งเตือนพร้อม PDF เข้ากลุ่ม LINE ทันที
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-5 items-center">
                      <input
                        id="lineAutoSendWto"
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-[#0F172A] focus:ring-0 cursor-pointer"
                        checked={form.lineAutoSendWto}
                        onChange={(e) => update('lineAutoSendWto', e.target.checked)}
                      />
                    </div>
                    <div className="text-sm">
                      <label htmlFor="lineAutoSendWto" className="font-bold text-slate-700 cursor-pointer">
                        ส่งใบส่งของ WTO อัตโนมัติ (Auto-Send WTO)
                      </label>
                      <p className="text-xs text-slate-400">
                        เมื่อสร้างใบส่งของ WTO สำเร็จ ระบบจะส่งแจ้งเตือนพร้อม PDF เข้ากลุ่ม LINE ทันที
                      </p>
                    </div>
                  </div>
                </div>

                {/* Google Sheets Webhook URL */}
                <div className="space-y-1">
                  <label className="block text-sm font-bold text-slate-700">
                    Google Sheets Webhook URL (การเชื่อมต่อสตรีมข้อมูล)
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-350 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-700 focus:outline-none focus:ring-0 h-10"
                    type="url"
                    placeholder="เช่น https://script.google.com/macros/s/AKfycb.../exec"
                    value={form.googleSheetsWebhookUrl ?? ''}
                    onChange={(e) => update('googleSheetsWebhookUrl', e.target.value)}
                  />
                  {fieldErrors.googleSheetsWebhookUrl ? (
                    <p className="text-xs text-red-600">{fieldErrors.googleSheetsWebhookUrl}</p>
                  ) : null}
                  <p className="text-xs text-slate-400">
                    ลิงก์ Webhook URL สำหรับส่งข้อมูลผลสรุปใบชั่งไปบันทึกบน Google Sheets อัตโนมัติเมื่อส่งแจ้งเตือน LINE สำเร็จ (เว้นว่างไว้หากไม่เปิดใช้งาน)
                  </p>
                </div>
              </div>
            </div>

            {/* Footer buttons row */}
            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 transition focus:outline-none h-10"
                onClick={() => void loadData()}
                disabled={isLoading || isSaving || isTesting || isTestingOA || isTestingWebhook}
              >
                โหลดใหม่
              </button>

              <button
                type="button"
                className="px-4 py-2 text-sm font-semibold text-emerald-600 border border-emerald-600 hover:bg-emerald-50 rounded-lg transition focus:outline-none h-10 flex items-center justify-center disabled:opacity-60"
                onClick={() => void handleTestSend()}
                disabled={isLoading || isSaving || isTesting || isTestingOA || isTestingWebhook}
              >
                {isTesting ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" />
                ) : (
                  '🔔 ทดสอบส่งข้อความ'
                )}
              </button>

              <button
                type="button"
                className="px-6 py-2 text-sm font-bold text-white bg-[#0F172A] hover:bg-[#1E293B] rounded-lg transition disabled:opacity-60 focus:outline-none h-10 flex items-center justify-center min-w-[100px]"
                onClick={() => void save()}
                disabled={isLoading || isSaving || isTesting || isTestingOA || isTestingWebhook}
              >
                {isSaving ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-white" />
                ) : (
                  '💾 บันทึกการตั้งค่า'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Right Column: LINE Flex Message Live Preview */}
    <div className="lg:col-span-5 space-y-4">
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-6 flex flex-col items-center">
        <h2 className="text-base font-bold text-slate-900 pb-2 border-b border-slate-100 w-full mb-4 flex items-center gap-2">
          <span>📱</span> LINE Flex Message Live Preview
        </h2>

        {/* Mock Phone Container */}
        <div className="w-full max-w-[320px] rounded-[32px] border-[8px] border-slate-800 bg-[#7494C0] shadow-lg overflow-hidden flex flex-col relative aspect-[9/15]">
          {/* Phone Status Bar */}
          <div className="bg-[#6686b0] px-4 py-2 flex justify-between items-center text-[10px] text-white/85 font-semibold select-none">
            <span>01:28</span>
            <div className="flex items-center gap-1">
              <span>📶</span>
              <span>🔋 99%</span>
            </div>
          </div>

          {/* Chat Header */}
          <div className="bg-[#2C3E50] px-3 py-2 flex items-center gap-2 text-white">
            <span className="text-sm">⬅️</span>
            <div className="h-6 w-6 rounded-full bg-emerald-600 flex items-center justify-center text-[10px] font-bold text-white">
              NP
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold leading-tight">NAMPEC Official</span>
              <span className="text-[8px] text-slate-300 leading-none">บอทของระบบ</span>
            </div>
          </div>

          {/* Chat Body */}
          <div className="flex-1 p-3 overflow-y-auto space-y-4 flex flex-col justify-end">
            {/* Chat Bubble Container */}
            <div className="flex items-start gap-2 max-w-[90%]">
              <div className="h-6 w-6 rounded-full bg-emerald-600 flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white mt-1">
                NP
              </div>

              <div className="space-y-1">
                <span className="text-[9px] text-slate-700 block font-semibold">NAMPEC Official</span>

                {/* LINE Flex Message bubble */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden text-xs border border-slate-200 w-[240px]">
                  {/* Body */}
                  <div className="p-3.5 space-y-3">
                    <div>
                      <p className="text-[#0f766e] font-bold text-[9px] uppercase tracking-wider">WTI (ใบรับของ)</p>
                      <h4 className="text-[#111827] font-bold text-[14px] leading-tight">WTI012606-0001</h4>
                      <p className="text-[#475569] text-[10px] mt-1 leading-snug">🔔 ระบบได้ทำการสร้างและตรวจวัดใบชั่งน้ำหนักเรียบร้อยแล้ว</p>
                    </div>

                    <div className="border-t border-slate-100 my-2"></div>

                    <div className="space-y-1.5 text-[10.5px]">
                      <div className="flex">
                        <span className="text-slate-400 w-16 flex-shrink-0">ผู้ขาย</span>
                        <span className="text-[#111827] font-medium truncate">ร้านค้าทดสอบ (LINE Test)</span>
                      </div>
                      <div className="flex">
                        <span className="text-slate-400 w-16 flex-shrink-0">สาขา</span>
                        <span className="text-[#111827] truncate">สำนักงานใหญ่ (HQ)</span>
                      </div>
                      <div className="flex">
                        <span className="text-slate-400 w-16 flex-shrink-0">วันที่/เวลา</span>
                        <span className="text-[#111827] truncate">24/06/2569 08:30</span>
                      </div>
                      <div className="flex">
                        <span className="text-slate-400 w-16 flex-shrink-0">โกดัง</span>
                        <span className="text-[#111827] truncate">คลังสินค้าหลัก (Main)</span>
                      </div>
                      <div className="flex">
                        <span className="text-slate-400 w-16 flex-shrink-0">ทะเบียนรถ</span>
                        <span className="text-[#111827] truncate">กข 1234 กรุงเทพ</span>
                      </div>
                      <div className="flex">
                        <span className="text-slate-400 w-16 flex-shrink-0">ผู้บันทึก</span>
                        <span className="text-[#111827] truncate">สมชาย ตั้งใจชั่ง</span>
                      </div>
                      <div className="flex">
                        <span className="text-slate-400 w-16 flex-shrink-0">รูปประกอบ</span>
                        <span className="text-[#111827]">3 รูป</span>
                      </div>
                      <div className="border-t border-dashed border-slate-100 my-1 pt-1"></div>
                      <div className="flex">
                        <span className="text-slate-400 w-16 flex-shrink-0">น้ำหนักรวม</span>
                        <span className="text-[#111827] font-medium">16,000 กก.</span>
                      </div>
                      <div className="flex">
                        <span className="text-slate-400 w-16 flex-shrink-0">หักภาชนะ</span>
                        <span className="text-[#111827]">1,000 กก.</span>
                      </div>
                      <div className="flex">
                        <span className="text-slate-400 w-16 flex-shrink-0">หักสิ่งเจือปน</span>
                        <span className="text-[#111827]">500 กก.</span>
                      </div>
                      <div className="flex">
                        <span className="text-slate-400 w-16 flex-shrink-0">สุทธิ</span>
                        <span className="text-[#0f766e] font-bold">14,500 กก.</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="bg-slate-50 border-t border-slate-100 flex flex-col p-2 gap-1.5">
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="w-full text-center py-1.5 rounded bg-[#0f766e] hover:bg-[#0d655e] text-white text-[10.5px] font-bold transition block shadow-sm"
                    >
                      เปิด PDF (ตัวอย่าง)
                    </a>
                    <a
                      href="#"
                      onClick={(e) => e.preventDefault()}
                      className="w-full text-center py-1.5 rounded border border-slate-200 hover:bg-slate-100 text-slate-700 text-[10.5px] font-semibold transition block"
                    >
                      เปิดในระบบ
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-3 text-center">
          * ภาพจำลองลักษณะข้อความแจ้งเตือน (Flex Message) ที่แสดงผลบนแอปพลิเคชัน LINE ของผู้รับปลายทาง
        </p>
      </div>
    </div>
  </div>

      {/* Section 4: LINE Group Routing (Full Width Card) */}
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span className="text-lg">👥</span> เส้นทางการแจ้งเตือนรายกลุ่ม (LINE Group Routing)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              กำหนดเงื่อนไขการกระจายการแจ้งเตือนแยกตามประเภทเอกสาร (WTI/WTO) และสาขาที่สังเกตการณ์สำหรับแต่ละกลุ่มไลน์
            </p>
          </div>
          {groupResize.hasCustomWidths && (
            <button
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 border border-slate-200 hover:bg-slate-50 rounded-md transition focus:outline-none flex items-center gap-1"
              type="button"
              onClick={groupResize.resetColumnWidths}
            >
              🔄 คืนค่าความกว้างตาราง
            </button>
          )}
        </div>

        {/* Desktop Table view (Hidden on Mobile/Tablet < 1024px) */}
        <div className="hidden lg:block overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm" style={{ minWidth: groupResize.tableMinWidth, tableLayout: 'fixed' }}>
              <colgroup>
                {groupRoutingColumns.map((col) => (
                  <col key={col.key} style={groupResize.getColumnStyle(col.key)} />
                ))}
              </colgroup>
              <thead className="bg-slate-100 text-xs font-semibold text-slate-600 select-none">
                <tr>
                  <ResizableTableHead
                    label="กลุ่มไลน์ / ไอดี"
                    activeSortKey={groupSortBy}
                    sortKey="name"
                    direction={groupSortDir}
                    onSort={(key) => handleGroupSort(key as any)}
                    resizeProps={groupResize.getResizeHandleProps('groupInfo', 'กลุ่มไลน์ / ไอดี')}
                  />
                  <ResizableTableHead
                    label="สาขาที่แจ้งเตือน"
                    activeSortKey={groupSortBy}
                    sortKey="branchCode"
                    direction={groupSortDir}
                    onSort={(key) => handleGroupSort(key as any)}
                    resizeProps={groupResize.getResizeHandleProps('branchCode', 'สาขาที่แจ้งเตือน')}
                  />
                  <ResizableTableHead align="center" label="แจ้ง WTI" resizeProps={groupResize.getResizeHandleProps('notifyWti', 'แจ้ง WTI')} />
                  <ResizableTableHead align="center" label="แจ้ง WTO" resizeProps={groupResize.getResizeHandleProps('notifyWto', 'แจ้ง WTO')} />
                  <ResizableTableHead
                    align="center"
                    label="สถานะใช้งาน"
                    activeSortKey={groupSortBy}
                    sortKey="isActive"
                    direction={groupSortDir}
                    onSort={(key) => handleGroupSort(key as any)}
                    resizeProps={groupResize.getResizeHandleProps('isActive', 'สถานะใช้งาน')}
                  />
                  <ResizableTableHead align="right" label="จัดการ" resizeProps={groupResize.getResizeHandleProps('actions', 'จัดการ')} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedGroups.map((group) => {
                  const isSavingRow = savingGroupIds[group.groupId]
                  return (
                    <tr key={group.groupId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          {group.pictureUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- LINE avatar URLs are external and may not be in the Next image allowlist.
                            <img src={group.pictureUrl} alt={group.name} className="h-7 w-7 rounded-full object-cover border border-slate-200" />
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-slate-200 flex items-center justify-center text-xs">👥</div>
                          )}
                          <div className="truncate">
                            <div className="font-bold text-slate-800 leading-snug">{group.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono select-all truncate max-w-[180px]">{group.groupId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <select
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-0 h-9"
                          value={group.branchCode || ''}
                          onChange={(e) => updateGroupLocal(group.groupId, 'branchCode', e.target.value || null)}
                        >
                          <option value="">-- ทุกสาขา (Global) --</option>
                          {branches.map((b) => (
                            <option key={b.id} value={b.code || b.id}>
                              {b.name} ({b.code || 'ไม่มีรหัส'})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-[#0F172A] focus:ring-0 cursor-pointer"
                          checked={group.notifyWti}
                          onChange={(e) => updateGroupLocal(group.groupId, 'notifyWti', e.target.checked)}
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-[#0F172A] focus:ring-0 cursor-pointer"
                          checked={group.notifyWto}
                          onChange={(e) => updateGroupLocal(group.groupId, 'notifyWto', e.target.checked)}
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-[#0F172A] focus:ring-0 cursor-pointer"
                          checked={group.isActive}
                          onChange={(e) => updateGroupLocal(group.groupId, 'isActive', e.target.checked)}
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition disabled:opacity-60 h-8 flex items-center gap-1 ml-auto"
                          disabled={isSavingRow}
                          onClick={() => handleUpdateGroupRouting(group.groupId, {})}
                        >
                          {isSavingRow ? (
                            <div className="h-3 w-3 animate-spin rounded-full border border-slate-300 border-t-white" />
                          ) : (
                            <span>💾 บันทึก</span>
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {sortedGroups.length === 0 && (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-400 font-medium" colSpan={6}>ไม่พบกลุ่มไลน์ในระบบ</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile/Tablet Card list view (Visible on < 1024px) */}
        <div className="lg:hidden space-y-3">
          {sortedGroups.map((group) => {
            const isSavingRow = savingGroupIds[group.groupId]
            return (
              <div key={group.groupId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                  {group.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- LINE avatar URLs are external and may not be in the Next image allowlist.
                    <img src={group.pictureUrl} alt={group.name} className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-sm">👥</div>
                  )}
                  <div className="truncate flex-1">
                    <div className="font-bold text-slate-800 text-sm leading-snug">{group.name}</div>
                    <div className="text-[9px] text-slate-400 font-mono truncate select-all">{group.groupId}</div>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">สาขาที่เชื่อมโยง</label>
                    <select
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 h-9"
                      value={group.branchCode || ''}
                      onChange={(e) => updateGroupLocal(group.groupId, 'branchCode', e.target.value || null)}
                    >
                      <option value="">-- ทุกสาขา (Global) --</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.code || b.id}>
                          {b.name} ({b.code || 'ไม่มีรหัส'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-1">
                    <label className="flex flex-col items-center p-2 rounded-lg border border-slate-100 bg-slate-50 cursor-pointer">
                      <span className="text-[9px] text-slate-500 font-medium mb-1">แจ้ง WTI</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-[#0F172A] focus:ring-0"
                        checked={group.notifyWti}
                        onChange={(e) => updateGroupLocal(group.groupId, 'notifyWti', e.target.checked)}
                      />
                    </label>

                    <label className="flex flex-col items-center p-2 rounded-lg border border-slate-100 bg-slate-50 cursor-pointer">
                      <span className="text-[9px] text-slate-500 font-medium mb-1">แจ้ง WTO</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-[#0F172A] focus:ring-0"
                        checked={group.notifyWto}
                        onChange={(e) => updateGroupLocal(group.groupId, 'notifyWto', e.target.checked)}
                      />
                    </label>

                    <label className="flex flex-col items-center p-2 rounded-lg border border-slate-100 bg-slate-50 cursor-pointer">
                      <span className="text-[9px] text-slate-500 font-medium mb-1">ใช้งานอยู่</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-[#0F172A] focus:ring-0"
                        checked={group.isActive}
                        onChange={(e) => updateGroupLocal(group.groupId, 'isActive', e.target.checked)}
                      />
                    </label>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition disabled:opacity-60 h-9 flex items-center gap-1"
                    disabled={isSavingRow}
                    onClick={() => handleUpdateGroupRouting(group.groupId, {})}
                  >
                    {isSavingRow ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border border-slate-300 border-t-white" />
                    ) : (
                      <span>💾 บันทึกการตั้งค่า</span>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
          {sortedGroups.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-400 font-medium text-xs">
              ไม่พบกลุ่มไลน์ในระบบ
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 space-y-2">
        <p className="font-bold">💡 ข้อมูลเพิ่มเติมและลำดับความสำคัญ:</p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li>หากเว็ปนี้ไม่มีค่าที่ตั้งไว้ในฐานข้อมูล ระบบจะใช้ค่าเริ่มต้นจากไฟล์คอนฟิก <code>.env.local</code> แทน</li>
          <li>สำหรับความปลอดภัย ค่า Channel Access Token และ Channel Secret จะถูกจัดเก็บแบบปกติ แต่ไม่แสดงเป็นตัวอักษรยกเว้นจะกดปุ่มแสดง</li>
          <li><b>วิธีการให้ระบบจำกลุ่มใหม่</b>: เชิญบอทเข้ากลุ่มไลน์ที่คุณต้องการ ➡️ พิมพ์คำอะไรก็ได้ในกลุ่ม บอทจะเชื่อมโยงรายละเอียดและดึงรายชื่อกลุ่มนั้นมาแสดงในรายการ Dropdown หน้านี้โดยอัตโนมัติ</li>
        </ul>
      </div>
    </section>
  )
}
