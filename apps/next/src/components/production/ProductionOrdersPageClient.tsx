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
const statusOptions = ['', 'Open', 'Submitted', 'Approved', 'Completed', 'Closed', 'Cancelled']
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

  return (
    <section className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-bold">โหลดข้อมูลใบสั่งผลิตไม่ได้</div>
          <div className="mt-1">{error}</div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-5">
        <Metric label="ใบสั่งผลิต" value={`${data?.summary.total ?? 0}`} />
        <Metric label="แผนผลิต" value={formatMoney(data?.summary.qtyPlanned ?? 0)} />
        <Metric label="ต้นทุนเข้า" value={formatMoney(data?.summary.inputCost ?? 0)} />
        <Metric label="มูลค่าผลผลิต" value={formatMoney(data?.summary.outputValue ?? 0)} />
        <Metric label="ส่วนต่าง" value={formatMoney(data?.summary.variance ?? 0)} tone={(data?.summary.variance ?? 0) < 0 ? 'danger' : 'normal'} />
      </div>

      <div className="rounded-lg bg-white p-4 shadow">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_140px_140px_150px_150px_auto]">
          <input
            className="rounded-lg border px-3 py-2 text-sm"
            placeholder="ค้นหาเลขใบสั่งผลิต / สินค้า / หมายเหตุ"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
          <input className="rounded-lg border px-3 py-2 text-sm" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1) }} />
          <input className="rounded-lg border px-3 py-2 text-sm" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1) }} />
          <select className="rounded-lg border px-3 py-2 text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }}>
            {statusOptions.map((option) => <option key={option || 'all'} value={option}>{option || 'ทุกสถานะ'}</option>)}
          </select>
          <select className="rounded-lg border px-3 py-2 text-sm" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }}>
            {sortOptions.map((option) => <option key={option.value} value={option.value}>เรียง: {option.label}</option>)}
          </select>
          <div className="flex gap-2">
            <button className="rounded-lg border px-3 py-2 text-sm" type="button" onClick={() => setDirection((value) => value === 'asc' ? 'desc' : 'asc')}>
              {direction === 'asc' ? 'น้อยไปมาก' : 'มากไปน้อย'}
            </button>
            <button className="rounded-lg border px-3 py-2 text-sm" type="button" onClick={clearFilters}>ล้าง</button>
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={openCreate}>+ ใบสั่งผลิตใหม่</button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <div>พบทั้งหมด <span className="font-semibold text-slate-900">{data?.summary.total ?? 0}</span> รายการ</div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded border border-slate-300 px-2 py-1" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}>
            {pageSizeOptions.map((size) => <option key={size} value={size}>{size} / หน้า</option>)}
          </select>
          <button className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50" disabled={page <= 1} type="button" onClick={() => setPage((value) => Math.max(1, value - 1))}>ก่อนหน้า</button>
          <span className="px-1">หน้า {data?.page ?? page} / {totalPages}</span>
          <button className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50" disabled={page >= totalPages} type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>ถัดไป</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">เลขที่</th>
              <th className="p-2 text-left">วันที่</th>
              <th className="p-2 text-left">สินค้าเป้าหมาย</th>
              <th className="p-2 text-left">สาขา/คลัง</th>
              <th className="p-2 text-right">แผน</th>
              <th className="p-2 text-right">Input</th>
              <th className="p-2 text-right">Output</th>
              <th className="p-2 text-left">หมวดผลผลิต</th>
              <th className="p-2 text-center">สถานะ</th>
              <th className="p-2 text-center">เปิด</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={10}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && currentRows.map((row) => (
              <tr key={row.id} className="cursor-pointer border-t hover:bg-slate-50" onClick={() => openDetail(row)}>
                <td className="p-2 font-mono text-xs">{row.docNo}</td>
                <td className="p-2">{row.date}</td>
                <td className="p-2"><div className="font-medium">{row.productName}</div><div className="text-xs text-slate-500">{row.productCode || row.productId}</div></td>
                <td className="p-2"><div>{row.branchName}</div><div className="text-xs text-slate-500">{row.warehouseName}</div></td>
                <td className="p-2 text-right">{formatMoney(row.qtyPlanned)}</td>
                <td className="p-2 text-right">{formatMoney(row.inputQty)}</td>
                <td className="p-2 text-right">{formatMoney(row.outputQty)}</td>
                <td className="p-2">
                  {row.outputCategories.length ? row.outputCategories.map((category) => (
                    <span key={category.code} className="mr-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs">{category.name}</span>
                  )) : '-'}
                </td>
                <td className="p-2 text-center"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{row.status}</span></td>
                <td className="p-2 text-center"><button className="text-blue-600" type="button" onClick={(event) => { event.stopPropagation(); openDetail(row) }}>เปิด</button></td>
              </tr>
            ))}
            {!isLoading && currentRows.length === 0 ? <tr><td className="p-6 text-center text-slate-500" colSpan={10}>ไม่พบใบสั่งผลิต</td></tr> : null}
          </tbody>
        </table>
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
    <div className="rounded-lg bg-white p-3 shadow">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${tone === 'danger' ? 'text-red-700' : 'text-slate-900'}`}>{value}</div>
    </div>
  )
}

function ProductionOrderModal({ categories, mode, row, onClose }: { categories: Category[]; mode: 'create' | 'detail'; row: ProductionOrderRow | null; onClose: () => void }) {
  const isCreate = mode === 'create'
  const today = todayDateInput()

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-8">
      <div className="w-full max-w-5xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{isCreate ? 'ใบสั่งผลิตใหม่' : `ใบสั่งผลิต ${row?.docNo ?? ''}`}</h3>
            <p className="text-xs text-slate-500">โครงฟอร์มอ้างอิง legacy: Header, Input, Output, Process Cost และ Cost Allocation</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded border px-3 py-2 text-sm" disabled type="button">ส่งอนุมัติ</button>
            <button className="rounded border px-3 py-2 text-sm" disabled type="button">อนุมัติ</button>
            <button className="rounded border px-3 py-2 text-sm" disabled type="button">จบงาน</button>
            <button className="rounded border px-3 py-2 text-sm" disabled type="button">ปิดงาน Lock Cost</button>
          </div>
        </div>

        <div className="max-h-[76vh] space-y-4 overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <ReadField label="เลขที่เอกสาร" value={isCreate ? 'Auto ตอนบันทึก' : row?.docNo ?? '-'} />
            <ReadField label="วันที่" value={isCreate ? today : row?.date ?? '-'} />
            <ReadField label="สถานะ" value={isCreate ? 'Open' : row?.status ?? '-'} />
            <ReadField label="สินค้าเป้าหมาย" value={isCreate ? 'เลือกสินค้าใน Batch เขียนข้อมูล' : row?.productName ?? '-'} />
            <ReadField label="สาขา" value={isCreate ? 'เลือกสาขา' : row?.branchName ?? '-'} />
            <ReadField label="คลัง" value={isCreate ? 'เลือกคลัง' : row?.warehouseName ?? '-'} />
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="แผนผลิต" value={formatMoney(row?.qtyPlanned ?? 0)} />
            <Metric label="Input Qty" value={formatMoney(row?.inputQty ?? 0)} />
            <Metric label="Output Qty" value={formatMoney(row?.outputQty ?? 0)} />
            <Metric label="Variance" value={formatMoney(row?.variance ?? 0)} tone={(row?.variance ?? 0) < 0 ? 'danger' : 'normal'} />
          </div>

          <div className="rounded-lg border border-slate-200">
            <div className="border-b bg-slate-50 px-4 py-3 font-semibold">หมวดหมู่ผลผลิต</div>
            <div className="grid gap-3 p-4 md:grid-cols-4">
              {categories.map((category) => (
                <div key={category.code} className="rounded-lg border border-slate-200 p-3">
                  <div className="font-mono text-xs text-slate-500">{category.code}</div>
                  <div className="mt-1 font-semibold">{category.name}</div>
                  <div className="mt-2 text-xs text-slate-500">Stock: {category.stockEffect}</div>
                  <div className="text-xs text-slate-500">{category.availableForSale ? 'ขายได้' : 'ขายไม่ได้'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ActionPanel title="Input / เบิกวัตถุดิบ" action="+ เบิกวัตถุดิบ" count={row?.inputCount ?? 0} />
            <ActionPanel title="Output / รับผลผลิต" action="+ รับผลผลิต" count={row?.outputCount ?? 0} />
            <ActionPanel title="Process Cost" action="+ เพิ่มค่าใช้จ่าย" count={0} />
            <ActionPanel title="Cost Allocation" action="Recompute" count={0} />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100" type="button" onClick={onClose}>ปิด</button>
          <button className="rounded-lg bg-slate-300 px-5 py-2 text-sm font-semibold text-slate-600" disabled type="button">
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
      <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">{value}</div>
    </div>
  )
}

function ActionPanel({ action, count, title }: { action: string; count: number; title: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-slate-500">รายการปัจจุบัน {count}</div>
        </div>
        <button className="rounded border px-3 py-2 text-sm text-slate-500" disabled type="button">{action}</button>
      </div>
    </div>
  )
}
