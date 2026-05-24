'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney, todayDateInput } from '@/lib/daily'

type Category = { availableForSale: boolean; code: string; name: string; stockEffect: string }
type ProductionOrderRow = {
  branchName: string
  closedAt: string | null
  date: string
  docNo: string
  id: string
  inputCost: number
  inputCount: number
  inputQty: number
  notes: string
  outputCategories: Array<{ code: string; name: string }>
  outputCount: number
  outputQty: number
  outputValue: number
  productCode: string
  productId: string
  productName: string
  qtyPlanned: number
  status: string
  variance: number
  warehouseName: string
}
type ProductionOrdersPayload = {
  categories: Category[]
  page: number
  pageSize: number
  rows: ProductionOrderRow[]
  summary: { inputCost: number; outputValue: number; qtyPlanned: number; total: number; totalPages: number; variance: number }
}

const pageSizeOptions = [10, 25, 50, 100]
const statusOptions = ['', 'Draft', 'Pending Approval', 'Approved', 'In Production', 'Partially Completed', 'Completed', 'Closed', 'Cancelled', 'Open', 'Submitted']
const sortOptions = [
  { label: 'วันที่', value: 'date' },
  { label: 'เลขที่', value: 'docNo' },
  { label: 'สถานะ', value: 'status' },
  { label: 'แผนผลิต', value: 'qtyPlanned' },
  { label: 'ต้นทุนเข้า', value: 'inputCost' },
  { label: 'มูลค่าผลผลิต', value: 'outputValue' },
  { label: 'ส่วนต่าง', value: 'variance' },
]

export function ProductionOrdersPageClient() {
  const [data, setData] = useState<ProductionOrdersPayload | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [modalMode, setModalMode] = useState<'create' | 'detail' | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [selectedRow, setSelectedRow] = useState<ProductionOrderRow | null>(null)
  const [sort, setSort] = useState('date')
  const [status, setStatus] = useState('')

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        direction,
        page: String(page),
        pageSize: String(pageSize),
        sort,
      })
      if (search.trim()) params.set('search', search.trim())
      if (status) params.set('status', status)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      setData(await dailyFetchJson<ProductionOrdersPayload>(`/api/production/orders?${params.toString()}`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดใบสั่งผลิตไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [dateFrom, dateTo, direction, page, pageSize, search, sort, status])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const totalPages = data?.summary.totalPages ?? 1
  const categories = data?.categories ?? []

  const currentRows = useMemo(() => data?.rows ?? [], [data?.rows])

  function clearFilters() {
    setSearch('')
    setStatus('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  function openDetail(row: ProductionOrderRow) {
    setSelectedRow(row)
    setModalMode('detail')
  }

  function openCreate() {
    setSelectedRow(null)
    setModalMode('create')
  }

  function setPeriod(period: 'today' | 'week' | 'month' | '') {
    if (!period) {
      setDateFrom('')
      setDateTo('')
      setPage(1)
      return
    }
    const today = todayDateInput()
    const start = new Date(`${today}T00:00:00`)
    const end = new Date(start)
    if (period === 'week') start.setDate(start.getDate() - 6)
    if (period === 'month') start.setDate(1)
    setDateFrom(start.toISOString().slice(0, 10))
    setDateTo(end.toISOString().slice(0, 10))
    setPage(1)
  }

  return (
    <section className="space-y-4">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-bold">โหลดข้อมูลใบสั่งผลิตไม่ได้</div>
          <div className="mt-1">{error}</div>
        </div>
      ) : null}

      <div className="rounded-md bg-white p-3 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <input className="min-w-[260px] flex-1 rounded-md border px-3 py-2 text-sm" placeholder="ค้นหาเลขใบสั่งผลิต / สินค้า / หมายเหตุ..." type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
          <label className="text-xs text-slate-500">วันที่:</label>
          <input className="rounded-md border px-2 py-2 text-sm" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} />
          <span className="text-slate-400">→</span>
          <input className="rounded-md border px-2 py-2 text-sm" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1) }} />
          <select className="rounded-md border px-3 py-2 text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
            {statusOptions.map((option) => <option key={option || 'all'} value={option}>{option || 'ทุกสถานะ'}</option>)}
          </select>
          <select className="rounded-md border px-3 py-2 text-sm" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }}>
            {sortOptions.map((option) => <option key={option.value} value={option.value}>เรียง: {option.label}</option>)}
          </select>
          <button className="rounded-md border px-3 py-2 text-sm" type="button" onClick={() => setDirection((value) => value === 'asc' ? 'desc' : 'asc')}>{direction === 'asc' ? 'น้อยไปมาก' : 'มากไปน้อย'}</button>
          {(search || dateFrom || dateTo || status) ? <button className="rounded-md bg-slate-100 px-3 py-2 text-xs hover:bg-slate-200" type="button" onClick={clearFilters}>ล้าง</button> : null}
          <button className="ml-auto rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={openCreate}>+ ใบสั่งผลิตใหม่</button>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">ช่วง:</span>
          <button className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium hover:bg-slate-50" type="button" onClick={() => setPeriod('')}>ทั้งหมด</button>
          <button className="rounded-md border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50" type="button" onClick={() => setPeriod('today')}>วันนี้</button>
          <button className="rounded-md border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50" type="button" onClick={() => setPeriod('week')}>7 วัน</button>
          <button className="rounded-md border border-amber-200 bg-white px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50" type="button" onClick={() => setPeriod('month')}>เดือนนี้</button>
          <span className="ml-auto text-xs text-slate-500">พบ <b className="text-slate-700">{data?.summary.total ?? 0}</b> ใบ</span>
        </div>
      </div>

      {isLoading ? <div className="rounded-md bg-white p-10 text-center text-slate-500 shadow">กำลังโหลดข้อมูล</div> : null}
      {!isLoading && currentRows.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {currentRows.map((row) => {
            const yieldPct = row.inputQty > 0 ? (row.outputQty / row.inputQty) * 100 : 0
            return (
              <div key={row.id} className={`relative cursor-pointer overflow-hidden rounded-md border-2 p-4 shadow-md transition hover:shadow-xl ${cardClass(row.status)}`} onClick={() => openDetail(row)}>
                <div className="absolute right-2 top-2"><StatusBadge status={row.status} /></div>
                <div className="mb-1 font-mono text-xs text-slate-400">{row.docNo}</div>
                <div className="mb-3 text-xs text-slate-500">{row.date} · {row.branchName}</div>
                <div className="mb-3 rounded-md border border-slate-200 bg-white/80 p-3">
                  <div className="mb-1 text-xs text-slate-500">สินค้าที่ผลิต</div>
                  <div className="text-base font-bold leading-tight text-amber-700">{row.productName || 'ยังไม่ได้กำหนดสินค้า'}</div>
                  <div className="mt-1 text-xs text-slate-500">{row.productCode || row.productId || '-'} · {row.warehouseName}</div>
                </div>
                <div className="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-white/70 p-2"><div className="text-[10px] text-red-600">เบิก</div><div className="text-sm font-bold text-red-700">{formatMoney(row.inputQty)}</div></div>
                  <div className="rounded-md bg-white/70 p-2"><div className="text-[10px] text-amber-600">แผน</div><div className="text-sm font-bold text-amber-700">{formatMoney(row.qtyPlanned)}</div></div>
                  <div className="rounded-md bg-white/70 p-2"><div className="text-[10px] text-emerald-600">ผลิต</div><div className="text-sm font-bold text-emerald-700">{formatMoney(row.outputQty)}</div></div>
                </div>
                {row.inputQty > 0 ? (
                  <div className="mb-2">
                    <div className="mb-0.5 flex justify-between text-xs"><span className="text-slate-500">Yield</span><span className={`font-bold ${yieldPct >= 90 ? 'text-emerald-700' : yieldPct >= 70 ? 'text-blue-700' : 'text-amber-700'}`}>{yieldPct.toFixed(1)}%</span></div>
                    <div className="h-2 overflow-hidden rounded-md-full bg-slate-200"><div className={`h-full ${yieldPct >= 90 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : yieldPct >= 70 ? 'bg-gradient-to-r from-blue-400 to-indigo-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`} style={{ width: `${Math.min(100, yieldPct)}%` }} /></div>
                  </div>
                ) : null}
                <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                  <div className="text-xs"><span className="text-slate-500">ต้นทุน:</span><b className="ml-1 text-slate-700">{formatMoney(row.inputCost)}</b></div>
                  <button className="rounded-md bg-blue-600 px-3 py-1 text-xs font-bold text-white" type="button" onClick={(event) => { event.stopPropagation(); openDetail(row) }}>เปิด →</button>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
      {!isLoading && currentRows.length === 0 ? (
        <div className="rounded-md bg-white p-12 text-center text-slate-400 shadow">
          <div className="mb-2 text-5xl">ใบสั่งผลิต</div>
          <div>ยังไม่มีใบสั่งผลิต กดปุ่มเพิ่มใบสั่งผลิตใหม่เพื่อเริ่มต้น</div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <div>รวมทั้งหมด <span className="font-semibold text-slate-900">{data?.summary.total ?? 0}</span> รายการ</div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded-md border border-slate-300 px-2 py-1" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}>
            {pageSizeOptions.map((size) => <option key={size} value={size}>{size} / หน้า</option>)}
          </select>
          <button className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50" disabled={page <= 1} type="button" onClick={() => setPage((value) => Math.max(1, value - 1))}>ก่อนหน้า</button>
          <span className="px-1">หน้า {data?.page ?? page} / {totalPages}</span>
          <button className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50" disabled={page >= totalPages} type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>ถัดไป</button>
        </div>
      </div>

      {modalMode ? (
        <ProductionOrderModal
          categories={categories}
          mode={modalMode}
          row={selectedRow}
          onClose={() => {
            setModalMode(null)
            setSelectedRow(null)
          }}
        />
      ) : null}
    </section>
  )
}

function Metric({ label, value, tone = 'normal' }: { label: string; tone?: 'normal' | 'danger'; value: string }) {
  return (
    <div className="rounded-md bg-white p-3 shadow">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${tone === 'danger' ? 'text-red-700' : 'text-slate-900'}`}>{value}</div>
    </div>
  )
}

function cardClass(status: string) {
  if (status === 'Closed' || status === 'Completed') return 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50'
  if (status === 'In Production' || status === 'Partially Completed') return 'border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50'
  if (status === 'Cancelled') return 'border-slate-300 bg-slate-50 opacity-70'
  if (status === 'Approved') return 'border-amber-400 bg-amber-50'
  return 'border-slate-200 bg-white hover:border-blue-300'
}

function statusClass(status: string) {
  if (status === 'Approved') return 'bg-blue-100 text-blue-700'
  if (status === 'In Production') return 'bg-purple-100 text-purple-700'
  if (status === 'Partially Completed') return 'bg-amber-100 text-amber-700'
  if (status === 'Completed' || status === 'Closed') return 'bg-emerald-100 text-emerald-700'
  if (status === 'Cancelled') return 'bg-red-100 text-red-700'
  if (status === 'Pending Approval') return 'bg-yellow-100 text-yellow-700'
  return 'bg-slate-100 text-slate-700'
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-md-full px-2 py-1 text-xs font-bold ${statusClass(status)}`}>{status}</span>
}

function ProductionOrderModal({ categories, mode, row, onClose }: { categories: Category[]; mode: 'create' | 'detail'; row: ProductionOrderRow | null; onClose: () => void }) {
  const isCreate = mode === 'create'
  const today = todayDateInput()
  const [tab, setTab] = useState<'allocation' | 'cost' | 'header' | 'input' | 'output'>('header')
  const variance = row ? row.outputValue - row.inputCost : 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-8">
      <div className="w-full max-w-5xl overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="font-mono text-lg font-bold text-slate-900">{isCreate ? 'ใบสั่งผลิตใหม่' : row?.docNo ?? ''}</h3>
              <StatusBadge status={isCreate ? 'Draft' : row?.status ?? '-'} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md bg-yellow-500 px-3 py-1.5 text-xs text-white disabled:bg-slate-300" disabled type="button">ส่งอนุมัติ</button>
              <button className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white disabled:bg-slate-300" disabled type="button">อนุมัติ</button>
              <button className="rounded-md bg-teal-600 px-3 py-1.5 text-xs text-white disabled:bg-slate-300" disabled type="button">จบงาน</button>
              <button className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white disabled:bg-slate-300" disabled type="button">ปิดงาน Lock Cost</button>
              <button className="rounded-md bg-amber-600 px-3 py-1.5 text-xs text-white disabled:bg-slate-300" disabled type="button">ยกเลิก</button>
            </div>
          </div>
          <div className="rounded-md border-l-4 border-amber-500 bg-gradient-to-r from-amber-100 to-orange-100 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-amber-700">สินค้าที่ผลิต Lot นี้</div>
                <div className="text-lg font-bold text-amber-800">{isCreate ? 'เลือกสินค้าใน Batch เขียนข้อมูล' : row?.productName ?? 'ยังไม่ได้กำหนด'}</div>
                {!isCreate ? <div className="font-mono text-xs text-slate-500">{row?.productCode || row?.productId || '-'}</div> : null}
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Planned Output</div>
                <div className="text-base font-bold">{formatMoney(row?.qtyPlanned ?? 0)} กก.</div>
              </div>
            </div>
          </div>
          {!isCreate && row?.status === 'Closed' ? <LockBanner tone="amber" title="ใบสั่งผลิตนี้ปิดงานแล้ว" text="ห้ามเพิ่มรายการใหม่ และต้องออกแบบ audit/recompute ก่อนเปิดแก้ไข" /> : null}
          {!isCreate && row?.status === 'Completed' ? <LockBanner tone="emerald" title="ใบสั่งผลิตจบงานแล้ว รอปิดงาน" text="หน้าจอนี้เปิดอ่านเท่านั้นจนกว่าจะออกแบบ write semantics" /> : null}
          {!isCreate && row?.status === 'Cancelled' ? <LockBanner tone="red" title="ใบสั่งผลิตนี้ยกเลิกแล้ว" text="ห้ามเพิ่ม แก้ไข หรือ reverse ใน read baseline นี้" /> : null}
        </div>

        <div className="max-h-[76vh] space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <Metric label="วัตถุดิบเบิก" value={formatMoney(row?.inputQty ?? 0)} tone="danger" />
            <Metric label="ผลผลิตได้" value={formatMoney(row?.outputQty ?? 0)} />
            <Metric label="WIP คงเหลือ" value={formatMoney(Math.max(0, (row?.inputQty ?? 0) - (row?.outputQty ?? 0)))} />
            <Metric label="Loss" value={formatMoney(Math.max(0, (row?.inputQty ?? 0) - (row?.outputQty ?? 0)))} tone="danger" />
            <Metric label="RM Cost" value={formatMoney(row?.inputCost ?? 0)} />
            <Metric label="Output Value" value={formatMoney(row?.outputValue ?? 0)} />
          </div>

          <div className="flex overflow-x-auto rounded-md-t-md border-b bg-white shadow">
            {[
              ['header', 'Header'],
              ['input', `Input (${row?.inputCount ?? 0})`],
              ['output', `Output (${row?.outputCount ?? 0})`],
              ['cost', 'Process Cost (0)'],
              ['allocation', 'Cost Allocation'],
            ].map(([key, label]) => (
              <button key={key} className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm font-medium ${tab === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`} type="button" onClick={() => setTab(key as typeof tab)}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'header' ? (
            <div className="rounded-md-b-md bg-white p-5 shadow">
              <div className="mb-3 flex justify-between"><h3 className="font-semibold">รายละเอียดใบสั่งผลิต</h3><span className="text-xs text-slate-400">อ่านอย่างเดียว</span></div>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <ReadField label="เลขที่เอกสาร" value={isCreate ? 'Auto ตอนบันทึก' : row?.docNo ?? '-'} />
                <ReadField label="วันที่" value={isCreate ? today : row?.date ?? '-'} />
                <ReadField label="สถานะ" value={isCreate ? 'Draft' : row?.status ?? '-'} />
                <ReadField label="สินค้าเป้าหมาย" value={isCreate ? 'เลือกสินค้าใน Batch เขียนข้อมูล' : row?.productName ?? '-'} />
                <ReadField label="สาขา" value={isCreate ? 'เลือกสาขา' : row?.branchName ?? '-'} />
                <ReadField label="คลัง" value={isCreate ? 'เลือกคลัง' : row?.warehouseName ?? '-'} />
                <ReadField label="Planned Input" value={formatMoney(row?.qtyPlanned ?? 0)} />
                <ReadField label="Cost Allocation Method" value="By Input WAC" />
              </div>
              {row?.notes ? <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">{row.notes}</div> : null}
            </div>
          ) : null}

          {tab === 'input' ? <ReadOnlyTable empty="ยังไม่มีการเบิกวัตถุดิบ" title="วัตถุดิบที่เบิก (Multi-round)" action="+ เบิกวัตถุดิบ" columns={['เลขที่', 'วันที่', 'จำนวน', 'มูลค่า', 'สถานะ']} rows={row ? [[row.docNo, row.date, formatMoney(row.inputQty), formatMoney(row.inputCost), row.inputCount ? 'active' : '-']] : []} /> : null}
          {tab === 'output' ? <ReadOnlyTable empty="ยังไม่มีผลผลิต" title="ผลผลิต (Multi-round, multi-grade, รวม Loss/Waste)" action="+ รับผลผลิต" columns={['เลขที่', 'วันที่', 'Output Type', 'จำนวน', 'มูลค่า']} rows={row ? [[row.docNo, row.date, row.outputCategories.map((item) => item.name).join(', ') || '-', formatMoney(row.outputQty), formatMoney(row.outputValue)]] : []} /> : null}
          {tab === 'cost' ? <ReadOnlyTable empty="ยังไม่มี Process Cost" title="Process Cost" action="+ เพิ่มค่าใช้จ่าย" columns={['เลขที่', 'วันที่', 'ประเภท', 'จำนวน', 'สถานะ']} rows={[]} /> : null}
          {tab === 'allocation' ? (
            <div className="rounded-md-b-md bg-white p-5 shadow">
              <h3 className="mb-3 font-semibold">Cost Allocation Preview</h3>
              <div className="mb-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">RM Cost</div><div className="font-bold">{formatMoney(row?.inputCost ?? 0)}</div></div>
                <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">Process Cost</div><div className="font-bold">{formatMoney(0)}</div></div>
                <div className="rounded-md bg-blue-50 p-3"><div className="text-xs text-blue-600">Total Production Cost</div><div className="text-lg font-bold text-blue-700">{formatMoney(row?.inputCost ?? 0)}</div></div>
                <div className="rounded-md bg-emerald-50 p-3"><div className="text-xs text-emerald-600">Allocated to Outputs</div><div className="font-bold text-emerald-700">{formatMoney(row?.outputValue ?? 0)}</div></div>
              </div>
              <div className="mb-4 rounded-md border-l-4 border-amber-500 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
                <div className="mb-2 font-bold text-amber-800">Production Variance (เทียบเฉยๆ - ไม่นับใน P&L)</div>
                <div className="mb-3 text-xs text-slate-600">ระบบใช้ read-only summary จากใบสั่งผลิตปัจจุบัน ยังไม่เปิด recompute allocation หรือ posting</div>
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div className="rounded-md bg-white p-2"><div className="text-xs text-slate-500">Yield Qty</div><div className={`font-bold ${((row?.outputQty ?? 0) - (row?.inputQty ?? 0)) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatMoney((row?.outputQty ?? 0) - (row?.inputQty ?? 0))} กก.</div></div>
                  <div className="rounded-md bg-white p-2"><div className="text-xs text-slate-500">Yield Value</div><div className={`font-bold ${variance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatMoney(variance)}</div></div>
                  <div className="rounded-md bg-white p-2"><div className="text-xs text-slate-500">Loss Value</div><div className="font-bold text-red-700">{formatMoney(Math.max(0, -variance))}</div></div>
                  <div className="rounded-md bg-white p-2"><div className="text-xs text-slate-500">Material Variance</div><div className={`font-bold ${variance >= 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatMoney(variance)}</div></div>
                </div>
              </div>
              <ReadOnlyTable empty="ยังไม่มี Output" title="Allocation Rows" action="Recompute" columns={['Output', 'Type', 'Qty', 'Allocated Cost', 'Unit Cost']} rows={row ? [[row.productName, row.outputCategories.map((item) => item.name).join(', ') || '-', formatMoney(row.outputQty), formatMoney(row.outputValue), formatMoney(row.outputQty > 0 ? row.outputValue / row.outputQty : 0)]] : []} />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100" type="button" onClick={onClose}>ปิด</button>
          <button className="rounded-md bg-slate-300 px-5 py-2 text-sm font-semibold text-slate-600" disabled type="button">
            บันทึกจะเปิดใน Batch เขียน Production
          </button>
        </div>
      </div>
    </div>
  )
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{value}</div>
    </div>
  )
}

function ActionPanel({ action, count, title }: { action: string; count: number; title: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-slate-500">รายการปัจจุบัน {count}</div>
        </div>
        <button className="rounded-md border px-3 py-2 text-sm text-slate-500" disabled type="button">{action}</button>
      </div>
    </div>
  )
}

function LockBanner({ text, title, tone }: { text: string; title: string; tone: 'amber' | 'emerald' | 'red' }) {
  const className = tone === 'red' ? 'border-red-500 bg-red-50 text-red-700' : tone === 'emerald' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-amber-500 bg-amber-50 text-amber-700'
  return (
    <div className={`rounded-md border-l-4 p-3 ${className}`}>
      <div className="font-bold">{title}</div>
      <div className="text-xs">{text}</div>
    </div>
  )
}

function ReadOnlyTable({ action, columns, empty, rows, title }: { action: string; columns: string[]; empty: string; rows: string[][]; title: string }) {
  return (
    <div className="rounded-md-b-md bg-white p-5 shadow">
      <div className="mb-3 flex justify-between">
        <h3 className="font-semibold">{title}</h3>
        <button className="rounded-md bg-slate-300 px-3 py-1.5 text-xs text-white" disabled type="button">{action}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-100">
            <tr>{columns.map((column) => <th key={column} className="p-2 text-left">{column}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row[0] ?? 'row'}-${index}`} className="border-t">
                {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className="p-2">{cell}</td>)}
              </tr>
            ))}
            {rows.length === 0 ? <tr><td className="py-6 text-center text-slate-400" colSpan={columns.length}>{empty}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
