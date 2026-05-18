'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type TradingPayload = {
  deals: Array<{ customerName: string; date: string; dealNo: string; grossProfit: number; grossProfitPct: number; id: string; matchedPurchaseAmount: number; matchedQty: number; matchedSalesAmount: number; productName: string; purchaseBillNo: string; salesBillNo: string; status: string; supplierName: string }>
  purchases: Array<{ date: string; docNo: string; id: string; matchedAmount: number; remainingAmount: number; supplierName: string; totalAmount: number }>
  sales: Array<{ customerName: string; date: string; docNo: string; id: string; matchedAmount: number; remainingAmount: number; totalAmount: number }>
  summary: { activeDeals: number; grossProfit: number; purchaseRemaining: number; purchaseTotal: number; salesRemaining: number; salesTotal: number }
}

export function TradingMatchingPageClient() {
  const [data, setData] = useState<TradingPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'deals' | 'purchases' | 'sales'>('deals')

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      setData(await dailyFetchJson<TradingPayload>('/api/trading/matching'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลด Trading Matching ไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const deals = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (data?.deals ?? []).filter((row) => !query || `${row.dealNo} ${row.purchaseBillNo} ${row.salesBillNo} ${row.supplierName} ${row.customerName}`.toLowerCase().includes(query))
  }, [data?.deals, search])

  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-violet-700 to-indigo-700 p-5 text-white shadow">
        <h1 className="text-2xl font-bold">Trading Matching / จับคู่ดีล</h1>
        <p className="mt-1 text-sm opacity-90">อ่านบิลรับซื้อและบิลขายที่เป็น `TRADING` พร้อมสถานะการ match จาก trading deals</p>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="Active Deals" value={`${data?.summary.activeDeals ?? 0}`} />
        <Metric label="GP" value={formatMoney(data?.summary.grossProfit ?? 0)} />
        <Metric label="ซื้อ Trading" value={formatMoney(data?.summary.purchaseTotal ?? 0)} />
        <Metric label="ซื้อยังไม่ Match" value={formatMoney(data?.summary.purchaseRemaining ?? 0)} />
        <Metric label="ขายยังไม่ Match" value={formatMoney(data?.summary.salesRemaining ?? 0)} />
      </div>
      <div className="rounded-lg bg-white p-3 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <button className={`rounded px-4 py-2 text-sm ${tab === 'deals' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`} type="button" onClick={() => setTab('deals')}>Deals</button>
          <button className={`rounded px-4 py-2 text-sm ${tab === 'purchases' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`} type="button" onClick={() => setTab('purchases')}>Trading PB</button>
          <button className={`rounded px-4 py-2 text-sm ${tab === 'sales' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`} type="button" onClick={() => setTab('sales')}>Trading SB</button>
          <input className="ml-auto min-w-64 rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหา deal / PB / SB / คู่ค้า" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        {tab === 'deals' ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-100"><tr><th className="p-2 text-left">Deal</th><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">PB / Supplier</th><th className="p-2 text-left">SB / Customer</th><th className="p-2 text-right">Cost</th><th className="p-2 text-right">Sales</th><th className="p-2 text-right">GP</th><th className="p-2 text-center">สถานะ</th></tr></thead>
            <tbody>
              {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={8}>กำลังโหลดข้อมูล</td></tr> : null}
              {!isLoading && deals.map((row) => <tr key={row.id} className="border-t hover:bg-slate-50"><td className="p-2 font-mono text-xs">{row.dealNo}</td><td className="p-2">{row.date}</td><td className="p-2">{row.purchaseBillNo || '-'} · {row.supplierName}</td><td className="p-2">{row.salesBillNo || '-'} · {row.customerName}</td><td className="p-2 text-right">{formatMoney(row.matchedPurchaseAmount)}</td><td className="p-2 text-right">{formatMoney(row.matchedSalesAmount)}</td><td className="p-2 text-right font-semibold">{formatMoney(row.grossProfit)}</td><td className="p-2 text-center">{row.status}</td></tr>)}
            </tbody>
          </table>
        ) : (
          <TradingBillTable rows={tab === 'purchases' ? data?.purchases ?? [] : data?.sales ?? []} type={tab} />
        )}
      </div>
    </section>
  )
}

function TradingBillTable({ rows, type }: { rows: Array<{ customerName?: string; date: string; docNo: string; id: string; matchedAmount: number; remainingAmount: number; supplierName?: string; totalAmount: number }>; type: 'purchases' | 'sales' }) {
  return <table className="w-full text-sm"><thead className="bg-slate-100"><tr><th className="p-2 text-left">เลขที่</th><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">{type === 'purchases' ? 'Supplier' : 'Customer'}</th><th className="p-2 text-right">ยอดรวม</th><th className="p-2 text-right">Matched</th><th className="p-2 text-right">คงเหลือ</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t hover:bg-slate-50"><td className="p-2 font-mono text-xs">{row.docNo}</td><td className="p-2">{row.date}</td><td className="p-2">{type === 'purchases' ? row.supplierName : row.customerName}</td><td className="p-2 text-right">{formatMoney(row.totalAmount)}</td><td className="p-2 text-right">{formatMoney(row.matchedAmount)}</td><td className="p-2 text-right font-semibold">{formatMoney(row.remainingAmount)}</td></tr>)}</tbody></table>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white p-3 shadow"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-lg font-bold text-slate-900">{value}</div></div>
}
