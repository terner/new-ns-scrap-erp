'use client'

import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod'
import { ApiError, getErrorMessage, readJsonResponse } from '@/lib/api-client'
import { companyProfileSchema, emptyCompanyProfile, type CompanyProfileFormValues } from '@/lib/company-profile'
import { formatPhoneDisplay, sanitizePhoneInput } from '@/lib/format'

const payloadSchema = z.object({
  profile: companyProfileSchema,
})

type FieldErrors = Partial<Record<keyof CompanyProfileFormValues, string>>

function sanitizeEmail(value: string) {
  return value.replace(/[^\x20-\x7E]/g, '')
}

function sanitizeDigits(value: string, maxLength: number) {
  return value.replace(/\D/g, '').slice(0, maxLength)
}

function normalizeWebsite(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function fieldErrorsFromApi(caught: unknown): FieldErrors {
  if (!(caught instanceof ApiError)) return {}
  return Object.fromEntries(Object.entries(caught.fieldErrors).map(([key, value]) => [key, value?.[0] ?? 'ข้อมูลไม่ถูกต้อง'])) as FieldErrors
}

export function CompanyProfilePageClient() {
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [form, setForm] = useState<CompanyProfileFormValues>(emptyCompanyProfile)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/company-profile', { cache: 'no-store' })
      const payload = await readJsonResponse(response, payloadSchema, 'โหลดข้อมูลบริษัทไม่สำเร็จ')
      setForm(payload.profile)
    } catch (caught) {
      setError(getErrorMessage(caught, 'โหลดข้อมูลบริษัทไม่สำเร็จ'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  function update<K extends keyof CompanyProfileFormValues>(key: K, value: CompanyProfileFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => ({ ...current, [key]: undefined }))
    setMessage(null)
  }

  async function save() {
    setError(null)
    setMessage(null)
    const parsed = companyProfileSchema.safeParse({
      ...form,
      website: normalizeWebsite(form.website ?? ''),
    })

    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as FieldErrors)
      setError('กรุณาตรวจสอบข้อมูลในฟอร์ม')
      return false
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/company-profile', {
        body: JSON.stringify(parsed.data),
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      })
      const payload = await readJsonResponse(response, payloadSchema, 'บันทึกข้อมูลบริษัทไม่สำเร็จ')
      setForm(payload.profile)
      setFieldErrors({})
      setMessage('บันทึกข้อมูลบริษัทสำเร็จ')
      return true
    } catch (caught) {
      setFieldErrors(fieldErrorsFromApi(caught))
      setError(getErrorMessage(caught, 'บันทึกข้อมูลบริษัทไม่สำเร็จ'))
      return false
    } finally {
      setIsSaving(false)
    }
  }

  function uploadLogo(file: File | undefined) {
    if (!file) return
    if (file.size > 200 * 1024) {
      setError('ไฟล์ใหญ่เกิน 200KB กรุณาบีบอัดก่อน')
      return
    }
    const reader = new FileReader()
    reader.onload = () => update('logoUrl', String(reader.result ?? '') || null)
    reader.readAsDataURL(file)
  }

  async function previewReceipt() {
    const saved = await save()
    if (saved) window.alert('ยังไม่มีบิลซื้อให้ดูตัวอย่าง — สร้างบิลก่อน')
  }

  async function previewDelivery() {
    const saved = await save()
    if (saved) window.alert('ยังไม่มีบิลขายให้ดูตัวอย่าง — สร้างบิลก่อน')
  }

  return (
    <section className="space-y-3">
      <div className="rounded-xl bg-gradient-to-r from-blue-700 to-cyan-600 p-4 text-white shadow">
        <h1 className="text-xl font-bold">🏢 ข้อมูลบริษัท</h1>
        <p className="mt-1 text-sm opacity-90">ข้อมูลที่จะแสดงในใบรับสินค้า / ใบส่งของ — บันทึกครั้งเดียวใช้ได้ทุกใบ</p>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div> : null}
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div> : null}

      <div className="grid grid-cols-1 gap-3 rounded-xl bg-white p-4 text-sm shadow md:grid-cols-2">
        <TextField error={fieldErrors.name} label="ชื่อบริษัท (ไทย) *" value={form.name} onChange={(value) => update('name', value)} />
        <TextField error={fieldErrors.nameEn} label="ชื่อบริษัท (อังกฤษ)" value={form.nameEn ?? ''} onChange={(value) => update('nameEn', value || null)} />
        <TextField error={fieldErrors.taxId} inputMode="numeric" label="เลขประจำตัวผู้เสียภาษี (13 หลัก)" value={form.taxId ?? ''} onChange={(value) => update('taxId', sanitizeDigits(value, 13) || null)} />
        <TextField error={fieldErrors.branchCode} inputMode="numeric" label="รหัสสาขา (5 หลัก, ใส่ 00000 ถ้าสำนักงานใหญ่)" value={form.branchCode} onChange={(value) => update('branchCode', sanitizeDigits(value, 5))} />
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-bold text-slate-700">ที่อยู่ (ตามใบทะเบียนพาณิชย์) *</span>
          <textarea className="w-full rounded border px-3 py-2" rows={2} value={form.address} onChange={(event) => update('address', event.target.value)} />
          {fieldErrors.address ? <span className="mt-1 block text-xs text-red-600">{fieldErrors.address}</span> : null}
        </label>
        <TextField error={fieldErrors.phone} inputMode="tel" label="โทรศัพท์ *" value={form.phone} onChange={(value) => update('phone', sanitizePhoneInput(value))} />
        <TextField error={fieldErrors.fax} inputMode="tel" label="แฟกซ์" value={form.fax ?? ''} onChange={(value) => update('fax', sanitizePhoneInput(value) || null)} />
        <TextField error={fieldErrors.email} inputMode="email" label="อีเมล" type="email" value={form.email ?? ''} onChange={(value) => update('email', sanitizeEmail(value) || null)} />
        <TextField error={fieldErrors.website} inputMode="url" label="เว็บไซต์" value={form.website ?? ''} onBlur={() => update('website', normalizeWebsite(form.website ?? ''))} onChange={(value) => update('website', sanitizeEmail(value) || null)} />
        <TextField className="md:col-span-2" error={fieldErrors.bankInfo} label="ข้อมูลธนาคาร / เลขบัญชี (สำหรับใบส่งของ)" placeholder="เช่น KBank 123-4-56789-0 บริษัท นิวโซลูชั่นส์ (ไทยแลนด์) จำกัด" value={form.bankInfo ?? ''} onChange={(value) => update('bankInfo', value || null)} />
        <TextField className="md:col-span-2" error={fieldErrors.footerNote} label="ข้อความท้ายเอกสาร" placeholder="เช่น ขอขอบคุณที่ใช้บริการ" value={form.footerNote ?? ''} onChange={(value) => update('footerNote', value || null)} />

        <div className="rounded border bg-slate-50 p-3 md:col-span-2">
          <label className="mb-2 block text-xs font-bold text-slate-700">โลโก้บริษัท (สำหรับพิมพ์ในใบ — แนะนำไฟล์เล็กกว่า 200KB)</label>
          <div className="flex flex-wrap items-start gap-3">
            {form.logoUrl ? (
              <div className="rounded border bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="โลโก้บริษัท" className="max-h-20 max-w-[200px]" src={form.logoUrl} />
              </div>
            ) : (
              <div className="rounded border border-dashed border-slate-300 bg-white p-4 text-xs text-slate-400">ยังไม่มีโลโก้</div>
            )}
            <div className="flex flex-col gap-2">
              <input accept="image/*" className="text-xs" type="file" onChange={(event) => uploadLogo(event.target.files?.[0])} />
              {form.logoUrl ? <button className="text-left text-xs text-red-600 hover:underline" type="button" onClick={() => update('logoUrl', null)}>🗑 ลบโลโก้</button> : null}
              {fieldErrors.logoUrl ? <span className="text-xs text-red-600">{fieldErrors.logoUrl}</span> : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl bg-slate-50 p-4">
        <button className="rounded-lg bg-blue-600 px-6 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-60" disabled={isLoading || isSaving} type="button" onClick={() => void save()}>
          {isSaving ? 'กำลังบันทึก...' : '💾 บันทึก'}
        </button>
        <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60" disabled={isLoading || isSaving} type="button" onClick={() => void previewReceipt()}>👁 ดูตัวอย่างใบรับสินค้า</button>
        <button className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-60" disabled={isLoading || isSaving} type="button" onClick={() => void previewDelivery()}>👁 ดูตัวอย่างใบส่งของ</button>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        💡 <b>วิธีใช้:</b> หลังบันทึกข้อมูลบริษัทแล้ว — ไปหน้าบิลซื้อ/บิลขาย → กดปุ่ม &quot;🖨 ใบรับ&quot; หรือ &quot;🖨 ใบส่ง&quot; ในแต่ละบิล → จะเปิดหน้าต่างใหม่พร้อมพิมพ์ (Ctrl+P) หรือ Save as PDF ได้เลย
      </div>
    </section>
  )
}

function TextField({
  className,
  error,
  inputMode,
  label,
  onBlur,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  className?: string
  error?: string
  inputMode?: 'email' | 'numeric' | 'tel' | 'url'
  label: string
  onBlur?: () => void
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  value: string
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-bold text-slate-700">{label}</span>
      <input className="w-full rounded border px-3 py-2" inputMode={inputMode} placeholder={placeholder} type={type} value={value} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  )
}
