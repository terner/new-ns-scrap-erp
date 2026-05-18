'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type PoBuyPayload = {
  rows: Array<{ createdBy: string; date: string; docNo: string; expectedDelivery: string; id: string; itemCount: number; purpose: string; qty: number; remainingAmount: number; remainingQty: number; requireDelivery: boolean; status: string; supplierName: string; totalAmount: number }>
  summary: { costingOnly: number; delivery: number; open: number; remainingAmount: number; remainingQty: number; totalAmount: number; totalRows: number }
}

export function PoBuyPageClient() {
  const [data, setData] = useState<PoBuyPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'delivery' | 'costing'>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

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
      if (!query) return true
      return `${row.docNo} ${row.supplierName} ${row.status}`.toLowerCase().includes(query)
    })
  }, [data?.rows, filter, search])

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
          <input className="ml-auto min-w-64 rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหา PO / Supplier / สถานะ" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100"><tr><th className="p-2 text-left">เลขที่</th><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">Supplier</th><th className="p-2 text-center">ประเภท</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">คงเหลือ</th><th className="p-2 text-right">มูลค่า</th><th className="p-2 text-center">สถานะ</th><th className="p-2 text-left">ผู้กรอก</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={9}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && rows.map((row) => (
              <tr key={row.id} className="border-t hover:bg-slate-50">
                <td className="p-2 font-mono text-xs">{row.docNo}</td><td className="p-2">{row.date}</td><td className="p-2">{row.supplierName}</td><td className="p-2 text-center"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{row.requireDelivery ? 'Delivery' : 'Costing'}</span></td><td className="p-2 text-right">{formatMoney(row.qty)}</td><td className="p-2 text-right text-amber-700">{formatMoney(row.remainingQty)}</td><td className="p-2 text-right">{formatMoney(row.remainingAmount)}</td><td className="p-2 text-center">{row.status}</td><td className="p-2 text-xs">{row.createdBy || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white p-3 shadow"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-lg font-bold text-slate-900">{value}</div></div>
}
