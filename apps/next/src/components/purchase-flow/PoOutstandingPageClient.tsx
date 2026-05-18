'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type OutstandingRow = { date: string; docNo: string; expectedDelivery: string; id: string; partnerName: string; productName: string; qty: number; remainingQty: number; remainingValue: number; status: string; unitPrice: number }
type OutstandingPayload = {
  buyRows: OutstandingRow[]
  sellRows: OutstandingRow[]
  summary: { buyCount: number; buyRemainingQty: number; buyRemainingValue: number; sellCount: number; sellRemainingQty: number; sellRemainingValue: number }
}

export function PoOutstandingPageClient() {
  const [data, setData] = useState<OutstandingPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      setData(await dailyFetchJson<OutstandingPayload>('/api/po-reports/outstanding'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลด PO Outstanding ไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const source = tab === 'buy' ? data?.buyRows ?? [] : data?.sellRows ?? []
    return source.filter((row) => !query || `${row.docNo} ${row.partnerName} ${row.productName}`.toLowerCase().includes(query))
  }, [data?.buyRows, data?.sellRows, search, tab])

  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-amber-700 to-orange-700 p-5 text-white shadow">
        <h1 className="text-2xl font-bold">PO Outstanding</h1>
        <p className="mt-1 text-sm opacity-90">PO Buy ที่ยังไม่ได้รับของ และ PO Sell ที่ยังไม่ได้ส่งของ โดยตัด Costing-only ออกตาม legacy</p>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="PO Buy ค้าง" value={`${data?.summary.buyCount ?? 0}`} />
        <Metric label="Buy Qty คงเหลือ" value={formatMoney(data?.summary.buyRemainingQty ?? 0)} />
        <Metric label="Buy Value คงเหลือ" value={formatMoney(data?.summary.buyRemainingValue ?? 0)} />
        <Metric label="PO Sell ค้าง" value={`${data?.summary.sellCount ?? 0}`} />
      </div>
      <div className="rounded-lg bg-white p-3 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <button className={`rounded px-4 py-2 text-sm ${tab === 'buy' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`} type="button" onClick={() => setTab('buy')}>PO Buy Outstanding</button>
          <button className={`rounded px-4 py-2 text-sm ${tab === 'sell' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`} type="button" onClick={() => setTab('sell')}>PO Sell Outstanding</button>
          <input className="ml-auto min-w-64 rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหา PO / คู่ค้า / สินค้า" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100"><tr><th className="p-2 text-left">เลขที่</th><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">กำหนดส่ง</th><th className="p-2 text-left">{tab === 'buy' ? 'Supplier' : 'Customer'}</th><th className="p-2 text-left">สินค้า</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">คงเหลือ</th><th className="p-2 text-right">มูลค่าคงเหลือ</th><th className="p-2 text-center">สถานะ</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={9}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && rows.map((row) => (
              <tr key={row.id} className="border-t hover:bg-slate-50">
                <td className="p-2 font-mono text-xs">{row.docNo}</td><td className="p-2">{row.date}</td><td className="p-2">{row.expectedDelivery || '-'}</td><td className="p-2">{row.partnerName}</td><td className="p-2">{row.productName || '-'}</td><td className="p-2 text-right">{formatMoney(row.qty)}</td><td className="p-2 text-right text-amber-700">{formatMoney(row.remainingQty)}</td><td className="p-2 text-right">{formatMoney(row.remainingValue)}</td><td className="p-2 text-center">{row.status}</td>
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
