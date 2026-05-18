'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { dailyFetchJson, formatMoney, todayDateInput } from '@/lib/daily'
import { purchaseBillFormSchema, type PurchaseBillFormValues } from '@/lib/purchase-bill'

type BillRow = {
  branchId?: string
  branchName?: string
  channelId?: string
  channelName?: string
  createdAt?: string
  createdBy?: string
  customerName?: string
  date: string
  docNo: string
  grossProfit?: number
  hasVat?: boolean
  id: string
  itemCount: number
  paidAmount?: number
  payableBalance?: number
  purchaseSource?: string
  receivableBalance?: number
  receivedAmount?: number
  refNo?: string
  status: string
  supplierId?: string
  supplierName?: string
  totalAmount?: number
  transactionMode?: string
  updatedAt?: string
  updatedBy?: string
  vatInvoiceNo?: string
  vatInvoiceReceived?: boolean
  warehouseId?: string
  warehouseName?: string
}

type StockIssueRow = {
  branchName: string
  convertedToBillId: string
  customerName: string
  date: string
  docNo: string
  id: string
  itemCount: number
  status: string
  totalCost: number
  totalEstAmount: number
  warehouseName: string
}

type Option = {
  active?: boolean | null
  branch_id?: string | null
  code?: string | null
  id: string
  name: string
  unit?: string | null
}

type PurchasePayload = {
  branches: Option[]
  channels: Option[]
  products: Option[]
  rows: BillRow[]
  suppliers: Option[]
  warehouses: Option[]
}

type TransactionBillsPageClientProps = {
  mode: 'purchase' | 'sales' | 'stock-issue'
}

const blankItem = () => ({
  discount: 0,
  lotNo: null,
  note: null,
  price: 0,
  productId: '',
  qty: 0,
})

const initialPurchaseForm = (): PurchaseBillFormValues => ({
  branchId: null,
  channelId: null,
  date: todayDateInput(),
  docNo: null,
  hasVat: false,
  items: [blankItem()],
  notes: null,
  purchaseSource: 'SPOT_BUY',
  refNo: null,
  supplierId: '',
  transactionMode: 'STOCK',
  vatType: 'NONE',
  warehouseId: null,
})

export function TransactionBillsPageClient({ mode }: TransactionBillsPageClientProps) {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [filterMode, setFilterMode] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [form, setForm] = useState<PurchaseBillFormValues>(initialPurchaseForm())
  const [isExporting, setIsExporting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [options, setOptions] = useState<Omit<PurchasePayload, 'rows'>>({ branches: [], channels: [], products: [], suppliers: [], warehouses: [] })
  const [rows, setRows] = useState<Array<BillRow | StockIssueRow>>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const apiPath = mode === 'purchase' ? '/api/purchase/bills' : mode === 'sales' ? '/api/sales/bills' : '/api/sales/stock-issue'

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      if (mode === 'purchase') {
        const payload = await dailyFetchJson<PurchasePayload>(apiPath)
        setRows(payload.rows)
        setOptions({
          branches: payload.branches,
          channels: payload.channels,
          products: payload.products,
          suppliers: payload.suppliers,
          warehouses: payload.warehouses,
        })
      } else {
        const payload = await dailyFetchJson<{ rows: Array<BillRow | StockIssueRow> }>(apiPath)
        setRows(payload.rows)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [apiPath, mode])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const name = 'supplierName' in row ? row.supplierName : 'customerName' in row ? row.customerName : ''
      if (dateFrom && row.date < dateFrom) return false
      if (dateTo && row.date > dateTo) return false
      if (mode === 'purchase' && filterMode && 'transactionMode' in row && row.transactionMode !== filterMode) return false
      if (mode === 'purchase' && filterSource && 'purchaseSource' in row && row.purchaseSource !== filterSource) return false
      return !query || `${row.docNo} ${'refNo' in row ? row.refNo ?? '' : ''} ${name ?? ''} ${row.branchName ?? ''} ${row.warehouseName ?? ''}`.toLowerCase().includes(query)
    })
  }, [dateFrom, dateTo, filterMode, filterSource, mode, rows, search])

  const total = filteredRows.reduce((sum, row) => sum + (isStockIssueRow(row) ? row.totalEstAmount : row.totalAmount ?? 0), 0)
  const title = mode === 'purchase' ? 'บิลรับซื้อ' : mode === 'sales' ? 'บิลขาย' : 'เบิกออกรอบิล'
  const activeBranches = options.branches.filter((option) => option.active !== false)
  const activeChannels = options.channels.filter((option) => option.active !== false)
  const activeProducts = options.products.filter((option) => option.active !== false)
  const activeSuppliers = options.suppliers.filter((option) => option.active !== false)
  const activeWarehouses = options.warehouses.filter((option) => option.active !== false && (!form.branchId || option.branch_id === form.branchId))
  const formSubtotal = form.items.reduce((sum, item) => sum + Math.max(0, item.qty * item.price - item.discount), 0)
  const formVat = !form.hasVat || form.vatType === 'NONE' ? 0 : form.vatType === 'INCLUDE' ? formSubtotal * 7 / 107 : formSubtotal * 0.07
  const formTotal = form.hasVat && form.vatType === 'EXCLUDE' ? formSubtotal + formVat : formSubtotal

  function clearFilters() {
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setFilterMode('')
    setFilterSource('')
  }

  function openPurchaseForm() {
    setForm(initialPurchaseForm())
    setFieldErrors({})
    setError(null)
    setShowForm(true)
  }

  function updateForm<K extends keyof PurchaseBillFormValues>(key: K, value: PurchaseBillFormValues[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'branchId' ? { warehouseId: null } : {}),
      ...(key === 'hasVat' && value === false ? { vatType: 'NONE' } : {}),
    }))
    setFieldErrors((current) => ({ ...current, [key]: '' }))
  }

  function updateItem(index: number, key: keyof PurchaseBillFormValues['items'][number], value: string | number | null) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    }))
    setFieldErrors({})
  }

  function removeItem(index: number) {
    setForm((current) => ({ ...current, items: current.items.filter((_item, itemIndex) => itemIndex !== index) }))
  }

  async function savePurchaseBill() {
    const parsed = purchaseBillFormSchema.safeParse(form)
    if (!parsed.success) {
      const flattened = parsed.error.flatten()
      setFieldErrors(Object.fromEntries(Object.entries(flattened.fieldErrors).map(([key, value]) => [key, value?.[0] ?? 'ข้อมูลไม่ถูกต้อง'])))
      setError(flattened.formErrors[0] ?? 'กรุณาตรวจสอบข้อมูลในฟอร์ม')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await dailyFetchJson('/api/purchase/bills', {
        body: JSON.stringify(parsed.data),
        method: 'POST',
      })
      setShowForm(false)
      await loadData()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกบิลรับซื้อไม่ได้')
    } finally {
      setIsSaving(false)
    }
  }

  async function exportExcel() {
    setIsExporting(true)
    setError(null)
    try {
      const response = await fetch('/api/purchase/bills?format=xlsx', { cache: 'no-store' })
      if (!response.ok) throw new Error('Export Excel ไม่สำเร็จ')
      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition') ?? ''
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `purchase_bills_${new Date().toISOString().slice(0, 10)}.xlsx`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Export Excel ไม่สำเร็จ')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <section className="space-y-4">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <span><strong>{title}</strong>{mode === 'purchase' ? ' — รับซื้อเศษโลหะเข้าคลัง' : ' baseline อ่านข้อมูลจริงจาก DB'}</span>
      </div>

      <div className="space-y-2 rounded-xl bg-white p-3 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <input className="min-w-[260px] flex-1 rounded-lg border px-3 py-2 text-sm" placeholder={mode === 'purchase' ? 'ค้นหาเลขบิล / เลขอ้างอิง / ชื่อ Supplier...' : 'ค้นหาเลขที่ / ชื่อ / สาขา / คลัง'} type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          <label className="text-xs text-slate-500">วันที่:</label>
          <input className="rounded-lg border px-2 py-2 text-sm" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <span className="text-slate-400">→</span>
          <input className="rounded-lg border px-2 py-2 text-sm" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          {(search || dateFrom || dateTo || filterMode || filterSource) ? <button className="rounded bg-slate-100 px-3 py-2 text-xs hover:bg-slate-200" type="button" onClick={clearFilters}>✕ ล้าง Filter</button> : null}
          {mode === 'purchase' ? <button className="ml-auto rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60" disabled={isExporting} type="button" onClick={() => void exportExcel()}>{isExporting ? 'กำลัง Export...' : `📥 Export Excel (${filteredRows.length})`}</button> : null}
          {mode === 'purchase' ? <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700" type="button" onClick={openPurchaseForm}>+ บิลรับซื้อใหม่</button> : null}
        </div>
        {mode === 'purchase' ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">ประเภท:</span>
            <Segment value="" current={filterMode} label="ทั้งหมด" onClick={setFilterMode} />
            <Segment value="STOCK" current={filterMode} label="📦 STOCK" onClick={setFilterMode} />
            <Segment value="TRADING" current={filterMode} label="🔄 TRADING" onClick={setFilterMode} />
            <span className="mx-2 text-slate-300">|</span>
            <span className="text-xs text-slate-500">ที่มา:</span>
            <Segment value="" current={filterSource} label="ทั้งหมด" onClick={setFilterSource} />
            <Segment value="SPOT_BUY" current={filterSource} label="📦 SPOT BUY" onClick={setFilterSource} />
            <Segment value="PO_RECEIPT" current={filterSource} label="📋 PO_RECEIPT" onClick={setFilterSource} />
            <Segment value="MIXED" current={filterSource} label="🔀 ผสม" onClick={setFilterSource} />
            <span className="ml-auto text-xs text-slate-500">📊 พบ <b className="text-slate-700">{filteredRows.length.toLocaleString('th-TH')}</b> บิล</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <div>พบทั้งหมด <span className="font-semibold text-slate-900">{filteredRows.length}</span> รายการ · รวม <span className="font-semibold text-blue-700">{formatMoney(total)}</span></div>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">เลขที่</th>
              {mode === 'purchase' ? <th className="p-2 text-left">เลขที่อ้างอิง</th> : null}
              <th className="p-2 text-left">วันที่</th>
              <th className="p-2 text-left">{mode === 'purchase' ? 'ผู้ขาย' : 'ลูกค้า'}</th>
              <th className="p-2 text-left">สาขา / คลัง</th>
              {mode === 'purchase' ? <th className="p-2 text-center">ประเภท</th> : null}
              <th className="p-2 text-center">สถานะ</th>
              <th className="p-2 text-right">รายการ</th>
              <th className="p-2 text-right">ยอดรวม</th>
              {mode !== 'stock-issue' ? <th className="p-2 text-right">ค้างชำระ</th> : null}
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={mode === 'purchase' ? 10 : mode === 'stock-issue' ? 7 : 8}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && filteredRows.map((row) => (
              <tr key={row.id} className="border-t hover:bg-slate-50">
                <td className="p-2 font-mono text-xs">{row.docNo}</td>
                {mode === 'purchase' && !isStockIssueRow(row) ? <td className="p-2 font-mono text-xs text-slate-600">{row.refNo || '-'}</td> : null}
                <td className="p-2">{row.date}</td>
                <td className="p-2">{'supplierName' in row ? row.supplierName : row.customerName}</td>
                <td className="p-2">{row.branchName ?? '-'} / {row.warehouseName ?? '-'}</td>
                {mode === 'purchase' && !isStockIssueRow(row) ? <td className="p-2 text-center"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{row.transactionMode ?? '-'}</span></td> : null}
                <td className="p-2 text-center"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{row.status}</span></td>
                <td className="p-2 text-right">{row.itemCount}</td>
                <td className="p-2 text-right font-semibold">{formatMoney(isStockIssueRow(row) ? row.totalEstAmount : row.totalAmount ?? 0)}</td>
                {mode !== 'stock-issue' && !isStockIssueRow(row) ? <td className="p-2 text-right text-red-700">{formatMoney(mode === 'purchase' ? row.payableBalance ?? 0 : row.receivableBalance ?? 0)}</td> : null}
              </tr>
            ))}
            {!isLoading && filteredRows.length === 0 ? <tr><td className="p-6 text-center text-slate-500" colSpan={mode === 'purchase' ? 10 : mode === 'stock-issue' ? 7 : 8}>ยังไม่มีรายการ</td></tr> : null}
          </tbody>
        </table>
      </div>

      {showForm && mode === 'purchase' ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4">
          <div className="mx-auto my-4 flex max-h-[94vh] max-w-5xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white">
              <div>
                <h3 className="text-xl font-bold">📥 สร้างบิลรับซื้อใหม่</h3>
                <p className="mt-1 text-xs opacity-80">บันทึก header และรายการสินค้าในบิลรับซื้อ</p>
              </div>
              <button className="text-3xl leading-none text-white/80 hover:text-white" type="button" onClick={() => setShowForm(false)}>&times;</button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-6 text-sm">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="mb-3 font-bold text-slate-700">1. ประเภทบิล</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <RadioCard active={form.transactionMode === 'STOCK'} label="📦 STOCK" note="ซื้อเข้าสต๊อก · เลือกคลัง" onClick={() => updateForm('transactionMode', 'STOCK')} />
                  <RadioCard active={form.transactionMode === 'TRADING'} label="🔄 TRADING" note="ซื้อขายผ่านมือ · ไม่บังคับคลัง" onClick={() => updateForm('transactionMode', 'TRADING')} />
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
                <Field error={fieldErrors.date} label="วันที่ *"><input className="w-full rounded border px-3 py-2" type="date" value={form.date} onChange={(event) => updateForm('date', event.target.value)} /></Field>
                <Field error={fieldErrors.docNo} label="เลขที่บิล"><input className="w-full rounded border px-3 py-2 font-mono" value={form.docNo ?? ''} onChange={(event) => updateForm('docNo', event.target.value || null)} /></Field>
                <Field error={fieldErrors.refNo} label="เลขที่อ้างอิง"><input className="w-full rounded border px-3 py-2 font-mono" value={form.refNo ?? ''} onChange={(event) => updateForm('refNo', event.target.value || null)} /></Field>
                <SelectField error={fieldErrors.supplierId} label="ผู้ขาย *" options={activeSuppliers} value={form.supplierId} onChange={(value) => updateForm('supplierId', value)} />
                <SelectField error={fieldErrors.branchId} label="สาขา" options={activeBranches} value={form.branchId ?? ''} onChange={(value) => updateForm('branchId', value || null)} />
                <SelectField error={fieldErrors.warehouseId} label="คลัง" options={activeWarehouses} value={form.warehouseId ?? ''} onChange={(value) => updateForm('warehouseId', value || null)} />
                <SelectField error={fieldErrors.channelId} label="ช่องทางซื้อ" options={activeChannels} value={form.channelId ?? ''} onChange={(value) => updateForm('channelId', value || null)} />
                <Field label="ที่มา"><select className="w-full rounded border px-3 py-2" value={form.purchaseSource} onChange={(event) => updateForm('purchaseSource', event.target.value as PurchaseBillFormValues['purchaseSource'])}><option value="SPOT_BUY">SPOT BUY</option><option value="PO_RECEIPT">PO RECEIPT</option><option value="MIXED">MIXED</option></select></Field>
                <Field label="VAT"><select className="w-full rounded border px-3 py-2" value={form.vatType} onChange={(event) => updateForm('vatType', event.target.value as PurchaseBillFormValues['vatType'])}><option value="NONE">No VAT</option><option value="EXCLUDE">VAT 7% แยกนอก</option><option value="INCLUDE">VAT รวมใน</option></select></Field>
                <label className="flex items-center gap-2 pt-6 text-sm text-slate-700"><input checked={form.hasVat} className="size-4" type="checkbox" onChange={(event) => updateForm('hasVat', event.target.checked)} /> มี VAT</label>
                <Field className="md:col-span-3" error={fieldErrors.notes} label="หมายเหตุ"><textarea className="w-full rounded border px-3 py-2" rows={2} value={form.notes ?? ''} onChange={(event) => updateForm('notes', event.target.value || null)} /></Field>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-bold text-slate-700">2. รายการสินค้า</h4>
                  <button className="rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700" type="button" onClick={() => setForm((current) => ({ ...current, items: [...current.items, blankItem()] }))}>+ เพิ่มรายการ</button>
                </div>
                {fieldErrors.items ? <div className="mb-2 text-xs text-red-600">{fieldErrors.items}</div> : null}
                <div className="space-y-2">
                  {form.items.map((item, index) => (
                    <div key={index} className="grid gap-2 rounded-lg bg-slate-50 p-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                      <select className="rounded border px-2 py-2" value={item.productId} onChange={(event) => updateItem(index, 'productId', event.target.value)}>
                        <option value="">เลือกสินค้า</option>
                        {activeProducts.map((product) => <option key={product.id} value={product.id}>{product.code ? `${product.code} — ` : ''}{product.name}{product.unit ? ` (${product.unit})` : ''}</option>)}
                      </select>
                      <input className="rounded border px-2 py-2 text-right" min="0" placeholder="จำนวน/กก." type="number" value={item.qty || ''} onChange={(event) => updateItem(index, 'qty', Number(event.target.value || 0))} />
                      <input className="rounded border px-2 py-2 text-right" min="0" placeholder="ราคา" type="number" value={item.price || ''} onChange={(event) => updateItem(index, 'price', Number(event.target.value || 0))} />
                      <input className="rounded border px-2 py-2 text-right" min="0" placeholder="ส่วนลด" type="number" value={item.discount || ''} onChange={(event) => updateItem(index, 'discount', Number(event.target.value || 0))} />
                      <button className="rounded px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-40" disabled={form.items.length <= 1} type="button" onClick={() => removeItem(index)}>ลบ</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-white p-4 text-right shadow-sm">
                <div className="text-sm text-slate-600">Subtotal: <b>{formatMoney(formSubtotal)}</b></div>
                <div className="text-sm text-slate-600">VAT: <b>{formatMoney(formVat)}</b></div>
                <div className="text-xl font-bold text-blue-700">รวมสุทธิ {formatMoney(formTotal)}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2 rounded-b-2xl border-t bg-white p-4">
              <button className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50" type="button" onClick={() => setShowForm(false)}>ยกเลิก</button>
              <button className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60" disabled={isSaving} type="button" onClick={() => void savePurchaseBill()}>{isSaving ? 'กำลังบันทึก...' : 'บันทึกบิลรับซื้อ'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function Segment({ current, label, onClick, value }: { current: string; label: string; onClick: (value: string) => void; value: string }) {
  const active = current === value
  return <button className={`rounded border px-3 py-1 text-xs font-medium ${active ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 bg-white hover:bg-slate-50'}`} type="button" onClick={() => onClick(value)}>{label}</button>
}

function Field({ children, className, error, label }: { children: ReactNode; className?: string; error?: string; label: string }) {
  return <label className={className}><span className="mb-1 block text-xs font-bold text-slate-700">{label}</span>{children}{error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}</label>
}

function SelectField({ error, label, onChange, options, value }: { error?: string; label: string; onChange: (value: string) => void; options: Option[]; value: string }) {
  return (
    <Field error={error} label={label}>
      <select className="w-full rounded border px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">เลือก</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </Field>
  )
}

function RadioCard({ active, label, note, onClick }: { active: boolean; label: string; note: string; onClick: () => void }) {
  return (
    <button className={`rounded-lg border-2 p-3 text-left transition ${active ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`} type="button" onClick={onClick}>
      <div className="font-bold">{label}</div>
      <div className="text-xs text-slate-500">{note}</div>
    </button>
  )
}

function isStockIssueRow(row: BillRow | StockIssueRow): row is StockIssueRow {
  return 'totalEstAmount' in row
}
