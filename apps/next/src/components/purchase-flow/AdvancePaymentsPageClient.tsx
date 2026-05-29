'use client'

import { ArrowLeft, Download, ImagePlus, Plus, Save, X } from 'lucide-react'
import type React from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DatePickerInput } from '@/components/ui/date-picker-input'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SearchCombobox, type SearchComboboxOption } from '@/components/ui/SearchCombobox'
import { Select } from '@/components/ui/Select'
import { dailyFetchJson, formatMoney, type DailyAccountOption } from '@/lib/daily'
import { supplierAdvancePaymentFormSchema } from '@/lib/purchase-advance'

type OptionRow = {
  active: boolean | null
  code?: string | null
  id: string
  name: string
  unit?: string | null
}

type StatusOption = {
  label: string
  value: string
}

type AdvancePaymentSortDirection = 'asc' | 'desc'
type AdvancePaymentSortKey = 'accountName' | 'advanceDate' | 'allocatedAmount' | 'amount' | 'docNo' | 'largeScaleDocNo' | 'netWeight' | 'productName' | 'remainingAmount' | 'status' | 'supplierName'

type AdvancePaymentRow = {
  accountName: string
  advanceDate: string
  allocatedAmount: number
  amount: number
  branchName: string
  customerName: string
  docNo: string
  id: string
  largeScaleDocNo: string
  netWeight: number
  paymentMethod: string
  plateNo: string
  pricePerKg: number
  productName: string
  remainingAmount: number
  status: string
  statusLabel: string
  supplierCode: string
  supplierName: string
  weightIn: number
  weightOut: number
}

type Payload = {
  accounts: DailyAccountOption[]
  branches: OptionRow[]
  filters: { statuses: StatusOption[] }
  pagination: {
    page: number
    pageSize: number
    totalPages: number
    totalRows: number
  }
  paymentMethods: OptionRow[]
  products: OptionRow[]
  rows: AdvancePaymentRow[]
  summary: {
    pendingCount: number
    totalAdvance: number
    totalAllocated: number
    totalRemaining: number
  }
  suppliers: OptionRow[]
}

type FormState = Record<string, string>

type UploadedImageFile = {
  fileName: string
  id: string
  url: string | null
}

const emptyForm = (): FormState => ({
  amount: '',
  branchId: '',
  customerName: '',
  docNo: '',
  driverName: '',
  fundingAccountId: '',
  inDate: '',
  largeScaleDocNo: '',
  netWeight: '',
  outDate: '',
  paymentMethod: '',
  plateNo: '',
  pricePerKg: '',
  productId: '',
  productName: '',
  remark: '',
  scaleOperator: '',
  senderName: '',
  supplierId: '',
  weightIn: '',
  weightOut: '',
})

export function AdvancePaymentsPageClient() {
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [vehiclePhotoFiles, setVehiclePhotoFiles] = useState<UploadedImageFile[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [q, setQ] = useState('')
  const [statuses, setStatuses] = useState<string[]>([])
  const [sortDirection, setSortDirection] = useState<AdvancePaymentSortDirection>('desc')
  const [sortKey, setSortKey] = useState<AdvancePaymentSortKey>('advanceDate')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const queryString = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortDirection,
      sortKey,
    })
    if (q.trim()) params.set('q', q.trim())
    if (statuses.length > 0) params.set('statuses', statuses.join(','))
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)
    return params.toString()
  }, [dateFrom, dateTo, page, pageSize, q, sortDirection, sortKey, statuses])

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      const payload = await dailyFetchJson<Payload>(`/api/purchase/advance-payments?${queryString}`)
      setData(payload)
      setForm((current) => ({
        ...current,
        branchId: current.branchId,
        fundingAccountId: current.fundingAccountId,
        paymentMethod: current.paymentMethod,
      }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดรายการจ่ายเงินล่วงหน้าไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const supplierOptions = useMemo<SearchComboboxOption[]>(() => (data?.suppliers ?? []).map((supplier) => ({
    description: supplier.code ? `รหัส ${supplier.code}` : undefined,
    id: supplier.id,
    label: supplier.name,
    searchText: `${supplier.code ?? ''} ${supplier.name}`,
  })), [data?.suppliers])
  const activeProducts = useMemo(() => (data?.products ?? []).filter((product) => product.active !== false), [data?.products])
  const productOptions = useMemo<SearchComboboxOption[]>(() => activeProducts.map((product) => ({
    description: product.code ? `รหัส ${product.code}` : undefined,
    id: product.id,
    label: productOptionLabel(product),
    searchText: `${product.code ?? ''} ${product.name} ${product.unit ?? ''}`,
  })), [activeProducts])
  const selectedProduct = useMemo(() => activeProducts.find((product) => product.id === form.productId) ?? null, [activeProducts, form.productId])

  const computedAmount = useMemo(() => {
    const netWeight = Number(form.netWeight)
    const pricePerKg = Number(form.pricePerKg)
    if (!Number.isFinite(netWeight) || !Number.isFinite(pricePerKg)) return 0
    return Math.max(0, netWeight * pricePerKg)
  }, [form.netWeight, form.pricePerKg])

  const closeForm = useCallback(() => {
    setIsFormOpen(false)
    setVehiclePhotoFiles((current) => {
      current.forEach((file) => {
        if (file.url) URL.revokeObjectURL(file.url)
      })
      return []
    })
  }, [])

  const openForm = useCallback(() => {
    setFieldErrors({})
    setError(null)
    setForm((current) => ({
      ...emptyForm(),
      branchId: '',
      fundingAccountId: '',
      paymentMethod: '',
    }))
    setIsFormOpen(true)
  }, [])

  const updateForm = (field: string, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const removeVehiclePhoto = useCallback((fileId: string) => {
    setVehiclePhotoFiles((current) => {
      const target = current.find((file) => file.id === fileId)
      if (target?.url) URL.revokeObjectURL(target.url)
      return current.filter((file) => file.id !== fileId)
    })
    setFieldErrors((current) => {
      const next = { ...current }
      delete next.vehiclePhotoNames
      return next
    })
  }, [])

  const appendVehiclePhotos = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    const additions = Array.from(files).slice(0, 10).map((file) => ({
      fileName: file.name,
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
    }))
    setVehiclePhotoFiles((current) => [...current, ...additions].slice(0, 10))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next.vehiclePhotoNames
      return next
    })
  }, [])

  const submitForm = async () => {
    setError(null)
    setFieldErrors({})
    const parsed = supplierAdvancePaymentFormSchema.safeParse({
      ...form,
      productName: selectedProduct?.name ?? '',
      vehiclePhotoNames: vehiclePhotoFiles.map((file) => file.fileName),
    })
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors
      setFieldErrors(Object.fromEntries(Object.entries(flattened).map(([key, messages]) => [key, messages?.[0] ?? 'ข้อมูลไม่ถูกต้อง'])))
      return
    }

    setIsSaving(true)
    try {
      await dailyFetchJson('/api/purchase/advance-payments', {
        body: JSON.stringify(parsed.data),
        method: 'POST',
      })
      setForm(emptyForm())
      closeForm()
      await loadData()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกรายการจ่ายเงินล่วงหน้าไม่ได้')
    } finally {
      setIsSaving(false)
    }
  }

  const clearFilters = () => {
    setQ('')
    setStatuses([])
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const changeSort = (nextKey: AdvancePaymentSortKey) => {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(nextKey)
      setSortDirection(nextKey === 'advanceDate' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  const hasActiveFilters = Boolean(q || dateFrom || dateTo || statuses.length > 0)
  const exportHref = useMemo(() => `/api/purchase/advance-payments?${queryString ? `${queryString}&` : ''}format=xlsx`, [queryString])

  return (
    <section className="space-y-4">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      {isFormOpen ? (
        <>
          <div>
            <Button type="button" variant="outline" onClick={closeForm}><ArrowLeft className="mr-1 h-4 w-4" />กลับไปหน้ารายการ</Button>
          </div>
          <div className="rounded-md bg-white p-4 shadow">
          <div className="mb-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">สร้างรายการจ่ายเงินล่วงหน้า / มัดจำ</div>
              <div className="text-xs text-slate-500">บันทึกเอกสาร ADV ใหม่จากข้อมูลใบชั่งใหญ่และข้อมูลการจ่ายเงิน</div>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <FormSection
                description="ระบุผู้ขาย วิธีจ่าย และยอดเงินที่ต้องจ่ายล่วงหน้า"
                title="ข้อมูลการเงิน"
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <SearchCombobox error={fieldErrors.supplierId} errorKey="supplierId" inputId="advance-supplier" label="ผู้ขาย *" options={supplierOptions} value={form.supplierId} onChange={(value) => updateForm('supplierId', value)} />
                  <Field error={fieldErrors.branchId} label="สาขา *">
                    <Select className={`h-9 w-full px-2 py-1.5 ${form.branchId ? '' : 'text-slate-400'}`} value={form.branchId} onChange={(event) => updateForm('branchId', event.target.value)}>
                      <option disabled value="">เลือกสาขา</option>
                      {(data?.branches ?? []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </Select>
                  </Field>
                  <Field error={fieldErrors.paymentMethod} label="วิธีจ่าย *">
                    <Select className={form.paymentMethod ? '' : 'text-slate-400'} value={form.paymentMethod} onChange={(event) => updateForm('paymentMethod', event.target.value)}>
                      <option disabled value="">เลือกวิธีจ่าย</option>
                      {(data?.paymentMethods ?? []).map((method) => <option key={method.id} value={method.name}>{method.name}</option>)}
                    </Select>
                  </Field>
                  <Field error={fieldErrors.fundingAccountId} label="บัญชีที่จ่าย *">
                    <Select className={form.fundingAccountId ? '' : 'text-slate-400'} value={form.fundingAccountId} onChange={(event) => updateForm('fundingAccountId', event.target.value)}>
                      <option disabled value="">เลือกบัญชี</option>
                      {(data?.accounts ?? []).map((account) => <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>)}
                    </Select>
                  </Field>
                  <MoneyInputField error={fieldErrors.amount} label="ยอดมัดจำ *" value={form.amount} onChange={(value) => updateForm('amount', value)} />
                </div>
              </FormSection>

              <FormSection
                description="ผูกเอกสาร ADV กับข้อมูลอ้างอิงจากรถเข้า/ใบชั่งใหญ่"
                title="อ้างอิงใบชั่งใหญ่"
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <InputField error={fieldErrors.largeScaleDocNo} label="เลขที่ใบชั่งใหญ่" value={form.largeScaleDocNo} onChange={(value) => updateForm('largeScaleDocNo', value)} />
                  <Field error={fieldErrors.inDate} label="วันที่เข้า">
                    <DatePickerInput className="w-full" value={form.inDate} onChange={(value) => updateForm('inDate', value)} />
                  </Field>
                  <Field error={fieldErrors.outDate} label="วันที่ออก">
                    <DatePickerInput className="w-full" value={form.outDate} onChange={(value) => updateForm('outDate', value)} />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                description="กรอกข้อมูลสินค้า น้ำหนัก และราคาที่ใช้คำนวณอ้างอิง"
                title="สินค้าและน้ำหนัก"
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <InputField error={fieldErrors.customerName} label="ชื่อลูกค้า" value={form.customerName} onChange={(value) => updateForm('customerName', value)} />
                  <SearchCombobox
                    error={fieldErrors.productName}
                    errorKey="productName"
                    inputId="advance-product"
                    label="ชื่อสินค้า"
                    options={productOptions}
                    placeholder="พิมพ์รหัส/ชื่อสินค้า..."
                    value={form.productId}
                    onChange={(value) => updateForm('productId', value)}
                  />
                  <InputField error={fieldErrors.weightIn} label="น้ำหนักเข้า *" min="0" step="0.01" type="number" value={form.weightIn} onChange={(value) => updateForm('weightIn', value)} />
                  <InputField error={fieldErrors.weightOut} label="น้ำหนักออก *" min="0" step="0.01" type="number" value={form.weightOut} onChange={(value) => updateForm('weightOut', value)} />
                  <InputField error={fieldErrors.netWeight} label="น้ำหนักสุทธิ *" min="0" step="0.01" type="number" value={form.netWeight} onChange={(value) => updateForm('netWeight', value)} />
                  <MoneyInputField error={fieldErrors.pricePerKg} label="ราคา/กก. *" value={form.pricePerKg} onChange={(value) => updateForm('pricePerKg', value)} />
                </div>
              </FormSection>

              <FormSection
                description="รวบรวมข้อมูลตัวรถ รูปประกอบ และผู้ขับในจุดเดียว"
                title="ข้อมูลรถและผู้ขับ"
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <InputField error={fieldErrors.plateNo} label="ทะเบียนรถ" value={form.plateNo} onChange={(value) => updateForm('plateNo', value)} />
                  <InputField error={fieldErrors.driverName} label="พนักงานขับรถ" value={form.driverName} onChange={(value) => updateForm('driverName', value)} />
                  <div className="md:col-span-2 xl:col-span-3">
                    <Field error={fieldErrors.vehiclePhotoNames} label="รูปภาพรถ">
                      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
                        <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100">
                          <ImagePlus className="h-4 w-4" />
                          อัปโหลดรูปภาพรถ
                          <input
                            accept="image/*"
                            className="hidden"
                            multiple
                            type="file"
                            onChange={(event) => {
                              appendVehiclePhotos(event.target.files)
                              event.target.value = ''
                            }}
                          />
                        </label>
                        <div className="mt-2 space-y-2">
                          {vehiclePhotoFiles.length === 0 ? <div className="text-xs text-slate-400">ยังไม่มีรูปภาพรถ</div> : null}
                          {vehiclePhotoFiles.map((file) => (
                            <div key={file.id} className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5 text-xs ring-1 ring-slate-200">
                              {file.url ? (
                                <button
                                  className="min-w-0 flex-1 truncate text-left text-slate-700 hover:text-blue-700 hover:underline"
                                  title={file.fileName}
                                  type="button"
                                  onClick={() => window.open(file.url ?? '', '_blank', 'noopener,noreferrer')}
                                >
                                  {file.fileName}
                                </button>
                              ) : (
                                <span className="min-w-0 flex-1 truncate text-slate-700" title={file.fileName}>{file.fileName}</span>
                              )}
                              <button className="shrink-0 text-slate-500 hover:text-red-600" type="button" onClick={() => removeVehiclePhoto(file.id)}>
                                ลบ
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Field>
                  </div>
                </div>
              </FormSection>

              <FormSection
                description="ข้อมูลเสริมสำหรับการติดตามเอกสารและการตรวจสอบย้อนหลัง"
                title="ข้อมูลประกอบ"
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <InputField error={fieldErrors.scaleOperator} label="ผู้ชั่งน้ำหนัก" value={form.scaleOperator} onChange={(value) => updateForm('scaleOperator', value)} />
                  <InputField error={fieldErrors.senderName} label="ผู้ส่ง" value={form.senderName} onChange={(value) => updateForm('senderName', value)} />
                  <div className="md:col-span-2 xl:col-span-4">
                    <TextAreaField error={fieldErrors.remark} label="หมายเหตุ" rows={3} value={form.remark} onChange={(value) => updateForm('remark', value)} />
                  </div>
                </div>
              </FormSection>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-800">สรุปก่อนบันทึก</div>
              <SummaryLine label="น้ำหนักสุทธิ x ราคา" value={formatMoney(computedAmount)} />
              <SummaryLine label="ยอดมัดจำ" value={formatMoney(Number(form.amount) || 0)} />
              <SummaryLine label="ส่วนต่าง" value={formatMoney((Number(form.amount) || 0) - computedAmount)} />
              <div className="mt-4 flex gap-2">
                <Button disabled={isSaving} type="button" onClick={submitForm}><Save className="mr-1 h-4 w-4" />บันทึก ADV</Button>
                <Button type="button" variant="outline" onClick={closeForm}>ปิด</Button>
              </div>
            </div>
          </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Metric label="ยอดมัดจำในหน้านี้" value={formatMoney(data?.summary.totalAdvance ?? 0)} />
            <Metric label="ยังไม่อนุมัติ" value={`${data?.summary.pendingCount ?? 0}`} />
            <Metric label="ใช้หักบิลแล้ว" value={formatMoney(data?.summary.totalAllocated ?? 0)} />
            <Metric label="คงเหลือ" tone="amber" value={formatMoney(data?.summary.totalRemaining ?? 0)} />
          </div>

            <div className="space-y-2 rounded-md bg-white p-3 shadow">
              <div className="flex flex-wrap items-center gap-2">
              <Input className="min-w-[260px] flex-1 rounded-md" placeholder="ค้นหา ADV / ใบชั่งใหญ่ / ผู้ขาย / ทะเบียน..." type="search" value={q} onChange={(event) => { setQ(event.target.value); setPage(1) }} />
              <label className="text-xs text-slate-500">วันที่:</label>
              <DatePickerInput ariaLabel="จากวันที่" id="advance-payments-date-from" value={dateFrom} onChange={(value) => { setDateFrom(value); setPage(1) }} />
              <span className="text-slate-400">→</span>
              <DatePickerInput ariaLabel="ถึงวันที่" id="advance-payments-date-to" value={dateTo} onChange={(value) => { setDateTo(value); setPage(1) }} />
              {hasActiveFilters ? <Button size="xs" type="button" variant="secondary" onClick={clearFilters}>✕ ล้าง</Button> : null}
              <ExportButton href={exportHref} />
              <Button className="ml-auto h-9" size="sm" type="button" onClick={openForm}><Plus className="mr-1 h-4 w-4" />สร้าง</Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">สถานะ:</span>
              <Segment
                active={statuses.length === 0}
                label="ทั้งหมด"
                onClick={() => {
                  setStatuses([])
                  setPage(1)
                }}
              />
              {(data?.filters.statuses ?? []).filter((option) => option.value !== 'all').map((option) => (
                <Segment
                  key={option.value}
                  active={statuses.includes(option.value)}
                  label={option.label}
                  onClick={() => {
                    toggleStatusFilter(option.value, setStatuses)
                    setPage(1)
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <span>พบทั้งหมด {data?.pagination.totalRows ?? 0} รายการ</span>
            <div className="flex flex-wrap items-center gap-2">
              <Select aria-label="จำนวนรายการต่อหน้า" className="h-9 w-auto min-w-[96px] px-2" value={String(pageSize)} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}>
                {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} / หน้า</option>)}
              </Select>
              <Button className="h-9 font-normal" disabled={page <= 1} size="sm" type="button" variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))}>ก่อนหน้า</Button>
              <span className="px-1">หน้า {data?.pagination.page ?? page} / {data?.pagination.totalPages ?? 1}</span>
              <Button className="h-9 font-normal" disabled={page >= (data?.pagination.totalPages ?? 1)} size="sm" type="button" variant="outline" onClick={() => setPage((current) => current + 1)}>ถัดไป</Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md bg-white shadow">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <AdvancePaymentSortHeader activeKey={sortKey} direction={sortDirection} label="เลขที่" sortKey="docNo" onSort={changeSort} />
                  <AdvancePaymentSortHeader activeKey={sortKey} direction={sortDirection} label="วันที่" sortKey="advanceDate" onSort={changeSort} />
                  <AdvancePaymentSortHeader activeKey={sortKey} direction={sortDirection} label="ผู้ขาย" sortKey="supplierName" onSort={changeSort} />
                  <AdvancePaymentSortHeader activeKey={sortKey} direction={sortDirection} label="ใบชั่งใหญ่" sortKey="largeScaleDocNo" onSort={changeSort} />
                  <AdvancePaymentSortHeader activeKey={sortKey} direction={sortDirection} label="ทะเบียน / สินค้า" sortKey="productName" onSort={changeSort} />
                  <AdvancePaymentSortHeader activeKey={sortKey} align="right" direction={sortDirection} label="น้ำหนักสุทธิ" sortKey="netWeight" onSort={changeSort} />
                  <AdvancePaymentSortHeader activeKey={sortKey} align="right" direction={sortDirection} label="ยอดมัดจำ" sortKey="amount" onSort={changeSort} />
                  <AdvancePaymentSortHeader activeKey={sortKey} align="right" direction={sortDirection} label="ใช้แล้ว" sortKey="allocatedAmount" onSort={changeSort} />
                  <AdvancePaymentSortHeader activeKey={sortKey} align="right" direction={sortDirection} label="คงเหลือ" sortKey="remainingAmount" onSort={changeSort} />
                  <AdvancePaymentSortHeader activeKey={sortKey} direction={sortDirection} label="บัญชีจ่าย" sortKey="accountName" onSort={changeSort} />
                  <AdvancePaymentSortHeader activeKey={sortKey} direction={sortDirection} label="สถานะ" sortKey="status" onSort={changeSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? <tr><td className="p-8 text-center text-slate-500" colSpan={11}>กำลังโหลดข้อมูล</td></tr> : null}
                {!isLoading && (data?.rows ?? []).length === 0 ? <tr><td className="p-8 text-center text-slate-400" colSpan={11}>ยังไม่มีรายการจ่ายเงินล่วงหน้า</td></tr> : null}
                {!isLoading && (data?.rows ?? []).map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="p-2 font-mono text-xs whitespace-nowrap">{row.docNo}</td>
                    <td className="p-2 whitespace-nowrap">{row.advanceDate}</td>
                    <td className="p-2">{row.supplierName}</td>
                    <td className="p-2 font-mono text-xs">{row.largeScaleDocNo || '-'}</td>
                    <td className="p-2"><div>{row.plateNo || '-'}</div><div className="text-xs text-slate-500">{row.productName || '-'}</div></td>
                    <td className="p-2 text-right tabular-nums">{formatMoney(row.netWeight)}</td>
                    <td className="p-2 text-right font-medium tabular-nums">{formatMoney(row.amount)}</td>
                    <td className="p-2 text-right tabular-nums">{formatMoney(row.allocatedAmount)}</td>
                    <td className="p-2 text-right font-semibold text-amber-700 tabular-nums">{formatMoney(row.remainingAmount)}</td>
                    <td className="p-2">{row.paymentMethod} · {row.accountName}</td>
                    <td className="p-2"><StatusDot status={row.status} label={row.statusLabel} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

function Field({ children, error, label }: { children: React.ReactNode; error?: string; label: string }) {
  const hasInlineRequired = label.trim().endsWith('*')
  const labelText = hasInlineRequired ? label.trim().slice(0, -1).trimEnd() : label
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-600">{labelText}{hasInlineRequired ? <span className="ml-1 text-red-600">*</span> : null}</div>
      {children}
      {error ? <div className="mt-1 text-xs text-red-600">{error}</div> : null}
    </div>
  )
}

function accountOptionLabel(account: DailyAccountOption) {
  const codePrefix = account.code ? `${account.code} - ` : ''
  const typeSuffix = account.type ? ` (${account.type})` : ''
  return `${codePrefix}${account.name}${typeSuffix}`
}

function productOptionLabel(option: OptionRow) {
  return option.code ? `${option.code} - ${option.name}` : option.name
}

function FormSection({ children, description, title }: { children: React.ReactNode; description: string; title: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="mb-4">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-xs text-slate-500">{description}</div>
      </div>
      {children}
    </div>
  )
}

function InputField({ error, label, onChange, type = 'text', value, ...props }: { error?: string; label: string; onChange: (value: string) => void; type?: string; value: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  const numberClassName = type === 'number'
    ? '[appearance:textfield] text-right [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
    : ''
  return (
    <Field error={error} label={label}>
      <Input aria-invalid={Boolean(error)} className={`${numberClassName} ${error ? 'border-red-400 bg-red-50' : ''}`.trim()} type={type} value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </Field>
  )
}

function ExportButton({ href }: { href: string }) {
  return (
    <Button asChild className="gap-2" variant="export">
      <a href={href}>
        <Download className="h-4 w-4 shrink-0" />
        <span>ส่งออก Excel</span>
      </a>
    </Button>
  )
}

function AdvancePaymentSortHeader({
  activeKey,
  align = 'left',
  direction,
  label,
  onSort,
  sortKey,
}: {
  activeKey: AdvancePaymentSortKey
  align?: 'left' | 'right'
  direction: AdvancePaymentSortDirection
  label: string
  onSort: (key: AdvancePaymentSortKey) => void
  sortKey: AdvancePaymentSortKey
}) {
  const active = activeKey === sortKey
  const alignClass = align === 'right' ? 'justify-end text-right' : 'justify-start text-left'
  return (
    <th className="p-0">
      <button className={`flex w-full items-center gap-1 p-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 ${alignClass}`} type="button" onClick={() => onSort(sortKey)}>
        <span>{label}</span>
        <span className="text-slate-400">{active ? (direction === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  )
}

function sanitizeMoneyInput(value: string) {
  const digitsOnly = value.replace(/,/g, '').replace(/[^\d.]/g, '')
  const [integerPart = '', decimalPart = ''] = digitsOnly.split('.')
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, '') || (digitsOnly.startsWith('.') ? '0' : integerPart)
  if (digitsOnly.includes('.')) return `${normalizedInteger || '0'}.${decimalPart.slice(0, 2)}`
  return normalizedInteger
}

function formatMoneyInput(value: string) {
  const normalized = sanitizeMoneyInput(value)
  if (!normalized) return ''
  const numericValue = Number(normalized)
  if (!Number.isFinite(numericValue)) return ''
  return numericValue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function MoneyInputField({ error, label, onChange, value }: { error?: string; label: string; onChange: (value: string) => void; value: string }) {
  const [isFocused, setIsFocused] = useState(false)
  const displayValue = isFocused ? value : formatMoneyInput(value)

  return (
    <Field error={error} label={label}>
      <Input
        aria-invalid={Boolean(error)}
        className={`text-right ${error ? 'border-red-400 bg-red-50' : ''}`.trim()}
        inputMode="decimal"
        type="text"
        value={displayValue}
        onBlur={() => setIsFocused(false)}
        onChange={(event) => onChange(sanitizeMoneyInput(event.target.value))}
        onFocus={() => setIsFocused(true)}
      />
    </Field>
  )
}

function TextAreaField({ error, label, onChange, rows = 3, value, ...props }: { error?: string; label: string; onChange: (value: string) => void; rows?: number; value: string } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'>) {
  return (
    <Field error={error} label={label}>
      <textarea
        aria-invalid={Boolean(error)}
        className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100 ${error ? 'border-red-400 bg-red-50' : ''}`.trim()}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </Field>
  )
}

function Segment({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button className={`rounded-md border px-3 py-1 text-xs font-medium ${active ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 bg-white hover:bg-slate-50'}`} type="button" onClick={onClick}>{label}</button>
}

function toggleStatusFilter(value: string, setStatuses: Dispatch<SetStateAction<string[]>>) {
  setStatuses((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
}

function Metric({ label, tone, value }: { label: string; tone?: 'amber'; value: string }) {
  return <div className="rounded-md bg-white p-3 shadow"><div className="text-xs text-slate-500">{label}</div><div className={`mt-1 text-lg font-bold ${tone === 'amber' ? 'text-amber-700' : 'text-slate-900'}`}>{value}</div></div>
}

function StatusDot({ label, status }: { label: string; status: string }) {
  const color = status === 'pending_approval'
    ? 'bg-amber-500 text-amber-700'
    : status === 'paid' || status === 'allocated'
      ? 'bg-emerald-500 text-emerald-700'
      : status === 'cancelled'
        ? 'bg-red-500 text-red-700'
        : 'bg-blue-500 text-blue-700'
  return <span className={`inline-flex items-center gap-2 whitespace-nowrap text-xs ${color.split(' ')[1]}`}><span className={`h-2 w-2 rounded-full ${color.split(' ')[0]}`} />{label}</span>
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return <div className="mt-3 flex items-center justify-between text-sm"><span className="text-slate-500">{label}</span><span className="font-semibold tabular-nums">{value}</span></div>
}
