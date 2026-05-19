'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type PoBuyPayload = {
  filters: { statuses: string[] }
  rows: PoBuyRow[]
  summary: { costingOnly: number; delivery: number; open: number; remainingAmount: number; remainingQty: number; totalAmount: number; totalRows: number }
}

type PoBuyItem = {
  productId: string
  productName: string
  qty: number
  remainingQty: number
  unitPrice: number
}

type PoBuyRow = {
  createdBy: string
  date: string
  docNo: string
  expectedDelivery: string
  id: string
  itemCount: number
  items: PoBuyItem[]
  productName: string
  purpose: string
  purposeLabel: string
  qty: number
  remainingAmount: number
  remainingQty: number
  requireDelivery: boolean
  status: string
  supplierName: string
  totalAmount: number
}

export function PoBuyPageClient() {
  const [data, setData] = useState<PoBuyPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'delivery' | 'costing'>('all')
  const [fromDate, setFromDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedRow, setSelectedRow] = useState<PoBuyRow | null>(null)
  const [status, setStatus] = useState('all')
  const [toDate, setToDate] = useState('')

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      setData(await dailyFetchJson<PoBuyPayload>('/api/purchase/po-buy'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลด PO Buy ไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (data?.rows ?? []).filter((row) => {
      if (filter === 'delivery' && !row.requireDelivery) return false
      if (filter === 'costing' && row.requireDelivery) return false
      if (status !== 'all' && row.status !== status) return false
      if (fromDate && row.date < fromDate) return false
      if (toDate && row.date > toDate) return false
      if (!query) return true
      return `${row.docNo} ${row.supplierName} ${row.productName} ${row.status} ${row.purposeLabel}`.toLowerCase().includes(query)
    })
  }, [data?.rows, filter, fromDate, search, status, toDate])

  const openRows = (data?.rows ?? []).filter((row) => row.status.toLowerCase().includes('open'))
  const partialRows = (data?.rows ?? []).filter((row) => row.status.toLowerCase().includes('partial'))
  const receivedRows = (data?.rows ?? []).filter((row) => row.status.toLowerCase().includes('received'))
  const outstandingRows = (data?.rows ?? [])
    .filter((row) => row.requireDelivery && row.remainingQty > 0 && !row.status.toLowerCase().includes('cancel'))
    .sort((left, right) => (left.expectedDelivery || '9999-12-31').localeCompare(right.expectedDelivery || '9999-12-31'))
    .slice(0, 8)
  const topSuppliers = Array.from((data?.rows ?? []).reduce((map, row) => {
    const current = map.get(row.supplierName) ?? { count: 0, name: row.supplierName, outstanding: 0, value: 0 }
    current.count += 1
    current.outstanding += row.remainingAmount
    current.value += row.totalAmount
    map.set(row.supplierName, current)
    return map
  }, new Map<string, { count: number; name: string; outstanding: number; value: number }>()).values()).sort((left, right) => right.value - left.value).slice(0, 5)
  const exportHref = useMemo(() => {
    const params = new URLSearchParams({ format: 'xlsx' })
    if (search.trim()) params.set('q', search.trim())
    if (status !== 'all') params.set('status', status)
    if (filter !== 'all') params.set('purpose', filter)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    return `/api/purchase/po-buy?${params.toString()}`
  }, [filter, fromDate, search, status, toDate])

  const resetFilters = () => {
    setFilter('all')
    setFromDate('')
    setSearch('')
    setStatus('all')
    setToDate('')
  }

  const hasFilters = filter !== 'all' || status !== 'all' || fromDate || toDate || search.trim()

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <strong>📥 PO Buy = จองซื้อล่วงหน้า</strong> — ยังไม่นับเป็น Stock จริง แต่เข้า Cost Pool ใช้ Match กับ PO Sell ได้ทันที · 1 บิลรองรับหลายรายการ
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl bg-gradient-to-br from-blue-500 to-indigo-700 p-4 text-white shadow">
          <div className="text-xs opacity-80">📋 PO ทั้งหมด</div>
          <div className="text-2xl font-bold">{data?.summary.totalRows ?? 0}</div>
          <div className="mt-1 text-xs opacity-80">มูลค่ารวม {formatMoney(data?.summary.totalAmount ?? 0)}</div>
        </div>
        <Metric color="blue" label="🆕 Open" sublabel="รอรับ 100%" value={`${openRows.length || data?.summary.open || 0}`} />
        <Metric color="amber" label="⚙ Partial" sublabel="รับบางส่วน" value={`${partialRows.length}`} />
        <Metric color="emerald" label="✓ Received" sublabel="รับครบแล้ว" value={`${receivedRows.length}`} />
        <Metric box color="amber" label="⏳ น้ำหนักรอรับ" sublabel={`${outstandingRows.length} รายการ` } value={formatMoney(data?.summary.remainingQty ?? 0)} />
        <Metric box color="red" label="💰 มูลค่ารอรับ" sublabel={`${data?.summary.delivery ?? 0} PO`} value={formatMoney(data?.summary.remainingAmount ?? 0)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="mb-3 text-sm font-bold text-slate-700">🏆 Top 5 Supplier (ยอดสั่งซื้อ)</div>
          <BarList rows={topSuppliers.map((supplier) => ({ label: supplier.name, note: `${supplier.count} PO`, subnote: supplier.outstanding > 0 ? `⏳ รอรับ ${formatMoney(supplier.outstanding)}` : '', value: supplier.value }))} />
        </div>
        <div className="rounded-xl bg-white p-4 shadow">
          <div className="mb-3 flex items-center justify-between text-sm font-bold text-slate-700">
            <span>📋 PO ค้างรับสินค้า ({outstandingRows.length})</span>
            <span className="text-xs font-normal text-amber-700">เรียงตามวันส่งมอบ</span>
          </div>
          {outstandingRows.length === 0 ? <div className="py-4 text-center text-xs text-emerald-600">✅ ไม่มี PO ค้างรับ</div> : (
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50"><tr><th className="p-1 text-left">เลขที่</th><th className="p-1 text-left">Supplier</th><th className="p-1 text-left">สินค้า</th><th className="p-1 text-right">รอรับ</th><th className="p-1 text-right">มูลค่า</th><th className="p-1 text-left">วันส่ง</th></tr></thead>
                <tbody>{outstandingRows.map((row) => <tr key={row.id} className="border-t hover:bg-amber-50"><td className="p-1 font-mono">{row.docNo}</td><td className="max-w-28 truncate p-1">{row.supplierName}</td><td className="max-w-28 truncate p-1">{row.productName}</td><td className="p-1 text-right font-bold text-amber-700">{formatMoney(row.remainingQty)}</td><td className="p-1 text-right text-blue-700">{formatMoney(row.remainingAmount)}</td><td className="p-1">{row.expectedDelivery || '-'}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2 rounded-xl bg-white p-3 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <input className="min-w-[260px] flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="🔍 ค้นหาเลข PO / ชื่อ Supplier / ชื่อสินค้า / หมายเหตุ..." type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          <label className="text-xs text-slate-500">วันที่:</label>
          <input aria-label="วันที่เริ่มต้น" className="rounded-lg border px-2 py-2 text-sm" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <span className="text-slate-400">→</span>
          <input aria-label="วันที่สิ้นสุด" className="rounded-lg border px-2 py-2 text-sm" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          {hasFilters ? <button className="rounded bg-slate-100 px-3 py-2 text-xs hover:bg-slate-200" type="button" onClick={resetFilters}>✕ ล้าง</button> : null}
          <button className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-sm text-white opacity-60" type="button" disabled>+ PO Buy ใหม่</button>
          <a className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white" href={exportHref}>Export XLSX</a>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">สถานะ:</span>
          <button className={`rounded border px-3 py-1 text-xs font-medium ${status === 'all' ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 bg-white hover:bg-slate-50'}`} type="button" onClick={() => setStatus('all')}>ทั้งหมด</button>
          {['Open', 'Partially Received', 'Received', 'Cancelled'].map((item) => (
            <button key={item} className={`rounded border px-3 py-1 text-xs font-medium ${status === item ? statusButtonClass(item, true) : statusButtonClass(item, false)}`} type="button" onClick={() => setStatus(item)}>{item === 'Partially Received' ? 'Partial' : item}</button>
          ))}
          <select aria-label="สถานะ" className="rounded-lg border px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">ทุกสถานะ</option>
            {(data?.filters.statuses ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <span className="ml-auto text-xs text-slate-500">📊 พบ <b className="text-slate-700">{rows.length}</b> PO</span>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <PurposeCard active={filter === 'delivery'} count={data?.summary.delivery ?? 0} description="PO ที่ supplier ต้องส่งของ · เข้า PO Outstanding · ตัดบิลรับซื้อ" label="📦 ส่งของจริง" onClick={() => setFilter('delivery')} tone="indigo" />
        <PurposeCard active={filter === 'costing'} count={data?.summary.costingOnly ?? 0} description="Imported · ไม่เข้า PO Outstanding · matching กับ PO Sell เท่านั้น" label="💰 Cost Pool / Deal Costing" onClick={() => setFilter('costing')} tone="emerald" />
        <PurposeCard active={filter === 'all'} count={data?.summary.totalRows ?? 0} description="รวมทั้ง 2 ประเภท" label="📋 ทั้งหมด" onClick={() => setFilter('all')} tone="slate" />
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="w-full min-w-[1180px] text-sm">
          <thead className="bg-slate-100"><tr><th className="p-2 text-center">เลือก</th><th className="p-2 text-left">เลขที่</th><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">Supplier</th><th className="p-2 text-left">รายการ</th><th className="p-2 text-right">จำนวนรวม</th><th className="p-2 text-right">มูลค่ารวม</th><th className="p-2 text-right">รอรับรวม</th><th className="p-2 text-left">Delivery</th><th className="p-2 text-center">สถานะ</th><th className="p-2 text-right">Actions</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={11}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && !error && rows.length === 0 ? <tr><td className="py-10 text-center text-slate-400" colSpan={11}>ยังไม่มี PO Buy</td></tr> : null}
            {!isLoading && rows.map((row) => (
              <tr key={row.id} className={`border-t hover:bg-blue-50/30 ${!row.requireDelivery ? 'bg-emerald-50/30' : ''}`}>
                <td className="p-2 text-center"><input aria-label={`เลือก ${row.docNo}`} type="checkbox" disabled /></td>
                <td className="p-2 font-mono text-xs">{row.docNo}{!row.requireDelivery ? <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">💰 Costing</span> : null}</td>
                <td className="p-2">{row.date}</td>
                <td className="p-2">{row.supplierName}</td>
                <td className="max-w-72 truncate p-2 text-xs">{row.productName}</td>
                <td className="p-2 text-right">{formatMoney(row.qty)}</td>
                <td className="p-2 text-right font-medium">{formatMoney(row.totalAmount)}</td>
                <td className="p-2 text-right text-amber-700">{formatMoney(row.remainingQty)}</td>
                <td className="p-2">{row.expectedDelivery || '-'}</td>
                <td className="p-2 text-center"><span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge(row.status)}`}>{row.status}</span></td>
                <td className="whitespace-nowrap p-2 text-right">
                  <button className="mr-2 text-xs text-blue-600 hover:underline" type="button" onClick={() => setSelectedRow(row)}>ดู</button>
                  <button className="mr-2 text-xs text-amber-600 opacity-50" type="button" disabled>ย้าย</button>
                  <button className="text-xs text-red-600 opacity-50" type="button" disabled>ยกเลิก</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedRow ? <PoBuyDetailModal row={selectedRow} onClose={() => setSelectedRow(null)} /> : null}
    </section>
  )
}

function Metric({ box, color, label, sublabel, value }: { box?: boolean; color: 'amber' | 'blue' | 'emerald' | 'red'; label: string; sublabel: string; value: string }) {
  const colorClass = color === 'red' ? 'border-red-300 bg-red-50 text-red-700' : color === 'amber' ? `${box ? 'border-amber-300 bg-amber-50' : 'border-amber-500 bg-white'} text-amber-700` : color === 'emerald' ? 'border-emerald-500 bg-white text-emerald-700' : 'border-blue-500 bg-white text-blue-700'
  return <div className={`rounded-xl p-4 shadow ${box ? 'border-2' : 'border-l-4'} ${colorClass}`}><div className="text-xs">{label}</div><div className="text-2xl font-bold">{value}</div><div className="text-xs text-slate-400">{sublabel}</div></div>
}

function BarList({ rows }: { rows: { label: string; note: string; subnote: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  if (rows.length === 0) return <div className="text-xs text-slate-400">ไม่มีข้อมูล</div>
  return <div className="space-y-2">{rows.map((row, index) => <div key={row.label} className="text-xs"><div className="mb-0.5 flex items-center gap-2"><span className="w-4 text-center font-bold text-slate-400">{index + 1}</span><span className="flex-1 truncate">{row.label}</span><span className="text-slate-500">{row.note}</span><span className="w-24 text-right font-bold text-blue-700">{formatMoney(row.value)}</span></div><div className="ml-6 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-indigo-500" style={{ width: `${Math.min(100, row.value / max * 100)}%` }} /></div>{row.subnote ? <div className="ml-6 text-xs text-amber-600">{row.subnote}</div> : null}</div>)}</div>
}

function PurposeCard({ active, count, description, label, onClick, tone }: { active: boolean; count: number; description: string; label: string; onClick: () => void; tone: 'emerald' | 'indigo' | 'slate' }) {
  const activeClass = tone === 'emerald' ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200' : tone === 'indigo' ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-200' : 'border-slate-700 bg-slate-100 ring-2 ring-slate-300'
  const countClass = tone === 'emerald' ? 'text-emerald-700' : tone === 'indigo' ? 'text-indigo-700' : 'text-slate-700'
  return <button className={`rounded-xl border-2 p-3 text-left shadow-sm transition ${active ? activeClass : 'border-slate-200 bg-white hover:border-slate-400'}`} type="button" onClick={onClick}><div className="flex items-center justify-between"><div className="text-sm font-bold">{label}</div><div className={`text-2xl font-extrabold ${active ? countClass : 'text-slate-700'}`}>{count}</div></div><div className="mt-0.5 text-xs text-slate-500">{description}</div></button>
}

function statusButtonClass(status: string, active: boolean) {
  if (status === 'Open') return active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white hover:bg-blue-50'
  if (status === 'Partially Received') return active ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300 bg-white hover:bg-amber-50'
  if (status === 'Received') return active ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white hover:bg-emerald-50'
  return active ? 'border-slate-500 bg-slate-500 text-white' : 'border-slate-300 bg-white hover:bg-slate-100'
}

function statusBadge(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes('received')) return 'bg-emerald-100 text-emerald-700'
  if (normalized.includes('partial')) return 'bg-amber-100 text-amber-700'
  if (normalized.includes('cancel')) return 'bg-slate-100 text-slate-500'
  return 'bg-blue-100 text-blue-700'
}

function PoBuyDetailModal({ onClose, row }: { onClose: () => void; row: PoBuyRow }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-0 md:items-center md:justify-center md:p-4" role="dialog" aria-modal="true" aria-labelledby="po-buy-detail-title">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-lg bg-white shadow-xl md:max-w-3xl md:rounded-lg">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 id="po-buy-detail-title" className="font-semibold">รายละเอียด {row.docNo}</h2>
            <p className="text-sm text-slate-500">{row.supplierName}</p>
          </div>
          <button className="rounded-lg border px-3 py-1.5 text-sm" type="button" onClick={onClose}>ปิด</button>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <Detail label="วันที่" value={row.date || '-'} />
          <Detail label="กำหนดส่ง" value={row.expectedDelivery || '-'} />
          <Detail label="ประเภท" value={row.purposeLabel} />
          <Detail label="สถานะ" value={row.status} />
          <Detail label="Qty" value={formatMoney(row.qty)} />
          <Detail label="คงเหลือ" value={formatMoney(row.remainingQty)} />
        </div>
        <div className="px-4 pb-4">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-slate-100"><tr><th className="p-2 text-left">สินค้า</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">คงเหลือ</th><th className="p-2 text-right">ราคา</th></tr></thead>
              <tbody>
                {row.items.map((item, index) => (
                  <tr key={`${item.productId}-${index}`} className="border-t">
                    <td className="p-2">{item.productName || '-'}</td>
                    <td className="p-2 text-right">{formatMoney(item.qty)}</td>
                    <td className="p-2 text-right">{formatMoney(item.remainingQty)}</td>
                    <td className="p-2 text-right">{formatMoney(item.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 font-medium">{value}</div></div>
}
