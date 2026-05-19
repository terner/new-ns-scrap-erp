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
      <div className="rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 p-5 text-white shadow">
        <h1 className="text-2xl font-bold">PO Buy / จองซื้อ</h1>
        <p className="mt-1 text-sm opacity-90">อ่านจาก `po_buys` เพื่อใช้ต่อกับบิลรับซื้อแบบ PO Receipt และ PO Outstanding</p>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Metric label="PO ทั้งหมด" value={`${data?.summary.totalRows ?? 0}`} />
        <Metric label="Delivery" value={`${data?.summary.delivery ?? 0}`} />
        <Metric label="Costing-only" value={`${data?.summary.costingOnly ?? 0}`} />
        <Metric label="Open" value={`${data?.summary.open ?? 0}`} />
        <Metric label="คงเหลือ กก." value={formatMoney(data?.summary.remainingQty ?? 0)} />
        <Metric label="มูลค่าคงเหลือ" value={formatMoney(data?.summary.remainingAmount ?? 0)} />
      </div>
      <div className="rounded-lg bg-white p-3 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <button className={`rounded px-3 py-2 text-sm ${filter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`} type="button" onClick={() => setFilter('all')}>ทั้งหมด</button>
          <button className={`rounded px-3 py-2 text-sm ${filter === 'delivery' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`} type="button" onClick={() => setFilter('delivery')}>ส่งของจริง</button>
          <button className={`rounded px-3 py-2 text-sm ${filter === 'costing' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`} type="button" onClick={() => setFilter('costing')}>Costing-only</button>
          <select aria-label="สถานะ" className="rounded-lg border px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">ทุกสถานะ</option>
            {(data?.filters.statuses ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input aria-label="วันที่เริ่มต้น" className="rounded-lg border px-3 py-2 text-sm" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input aria-label="วันที่สิ้นสุด" className="rounded-lg border px-3 py-2 text-sm" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          <input className="min-w-64 flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหา PO / Supplier / สินค้า / สถานะ" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          {hasFilters ? <button className="rounded-lg border px-3 py-2 text-sm" type="button" onClick={resetFilters}>ล้าง</button> : null}
          <a className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white" href={exportHref}>Export XLSX</a>
        </div>
      </div>
      <div className="text-sm text-slate-500">พบ {rows.length.toLocaleString('th-TH')} จาก {data?.summary.totalRows ?? 0} PO</div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100"><tr><th className="p-2 text-left">เลขที่</th><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">Supplier</th><th className="p-2 text-left">สินค้า</th><th className="p-2 text-center">ประเภท</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">คงเหลือ</th><th className="p-2 text-right">มูลค่า</th><th className="p-2 text-center">สถานะ</th><th className="p-2 text-left">ผู้กรอก</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={10}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && !error && rows.length === 0 ? <tr><td className="p-6 text-center text-slate-500" colSpan={10}>ไม่พบข้อมูลตามเงื่อนไข</td></tr> : null}
            {!isLoading && rows.map((row) => (
              <tr key={row.id} className="cursor-pointer border-t hover:bg-slate-50" onClick={() => setSelectedRow(row)}>
                <td className="p-2 font-mono text-xs">{row.docNo}</td><td className="p-2">{row.date}</td><td className="p-2">{row.supplierName}</td><td className="max-w-72 truncate p-2 text-xs">{row.productName}</td><td className="p-2 text-center"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{row.purposeLabel}</span></td><td className="p-2 text-right">{formatMoney(row.qty)}</td><td className="p-2 text-right text-amber-700">{formatMoney(row.remainingQty)}</td><td className="p-2 text-right">{formatMoney(row.remainingAmount)}</td><td className="p-2 text-center">{row.status}</td><td className="p-2 text-xs">{row.createdBy || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedRow ? <PoBuyDetailModal row={selectedRow} onClose={() => setSelectedRow(null)} /> : null}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white p-3 shadow"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-lg font-bold text-slate-900">{value}</div></div>
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
