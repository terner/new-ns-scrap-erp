'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type DealMarginRow = {
  avgCost: number
  channel: string
  customer: string
  date: string
  docNo: string
  id: string
  margin: number
  marginPct: number
  matchedCost: number
  matchedQty: number
  product: string
  sellQty: number
  statusMatch: string
  totalRevenue: number
  unitPrice: number
}

type Payload = {
  filters: { channels: string[] }
  rows: DealMarginRow[]
  summary: { cost: number; fullyMatched: number; margin: number; marginPct: number; none: number; partial: number; revenue: number; rows: number }
  topDeals: DealMarginRow[]
}

export function DealMarginPageClient() {
  const [channel, setChannel] = useState('all')
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [toDate, setToDate] = useState('')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (channel !== 'all') params.set('channel', channel)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    return params.toString()
  }, [channel, fromDate, toDate])

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      setData(await dailyFetchJson<Payload>(`/api/dual-costing/deal-margin?${queryString}`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลด Deal Margin ไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const exportHref = `/api/dual-costing/deal-margin?${queryString ? `${queryString}&` : ''}format=xlsx`
  const marginPositive = (data?.summary.margin ?? 0) >= 0

  return (
    <section className="space-y-4">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      <div className="grid gap-3 md:grid-cols-3">
        <div className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-xl ${marginPositive ? 'bg-gradient-to-br from-purple-600 to-pink-700' : 'bg-gradient-to-br from-red-500 to-rose-700'}`}>
          <div className="text-xs opacity-90">Gross Margin (Deal)</div>
          <div className="mt-1 text-4xl font-bold">{formatMoney(data?.summary.margin ?? 0)}</div>
          <div className="mt-2 text-sm opacity-90">Margin {(data?.summary.marginPct ?? 0).toFixed(1)}%</div>
          <div className="mt-3 space-y-0.5 text-xs opacity-80">
            <div>Revenue: <b>{formatMoney(data?.summary.revenue ?? 0)}</b></div>
            <div>Cost: <b>{formatMoney(data?.summary.cost ?? 0)}</b></div>
            <div>{data?.summary.rows ?? 0} Deals · {data?.summary.fullyMatched ?? 0} Fully Matched</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow">
          <div className="mb-3 text-sm font-bold text-slate-700">Top 5 Deal กำไรสูงสุด</div>
          {(data?.topDeals.length ?? 0) === 0 ? <div className="text-xs text-slate-400">ไม่มีข้อมูล</div> : null}
          <div className="space-y-2">
            {(data?.topDeals ?? []).map((row, index) => (
              <div key={row.id} className="text-xs">
                <div className="mb-0.5 flex items-center gap-2">
                  <span className="w-4 text-center font-bold text-slate-400">{index + 1}</span>
                  <span className="flex-1 truncate">{row.docNo} · {row.customer}</span>
                  <span className={`w-20 text-right font-bold ${row.margin >= 0 ? 'text-purple-700' : 'text-red-600'}`}>{formatMoney(row.margin)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-gradient-to-r from-purple-400 to-pink-500" style={{ width: `${Math.min(100, Math.max(0, row.margin) / Math.max(data?.topDeals[0]?.margin || 1, 1) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow">
          <div className="mb-3 text-sm font-bold text-slate-700">📊 สถานะการ Match</div>
          <MatchStatusDonut
            fully={data?.summary.fullyMatched ?? 0}
            none={data?.summary.none ?? 0}
            partial={data?.summary.partial ?? 0}
            total={data?.summary.rows ?? 0}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Total Revenue (Deal)" tone="emerald" value={formatMoney(data?.summary.revenue ?? 0)} />
        <Metric label="Total Matched Cost" tone="red" value={formatMoney(data?.summary.cost ?? 0)} />
        <Metric label="Gross Margin (Deal)" tone="purple" value={formatMoney(data?.summary.margin ?? 0)} />
        <Metric label="Margin %" tone={marginPositive ? 'emerald' : 'red'} value={`${(data?.summary.marginPct ?? 0).toFixed(2)}%`} />
      </div>

      <div className="flex flex-wrap gap-2">
        <input className="rounded-lg border px-3 py-2 text-sm" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        <input className="rounded-lg border px-3 py-2 text-sm" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        <select className="rounded-lg border px-3 py-2 text-sm" value={channel} onChange={(event) => setChannel(event.target.value)}>
          <option value="all">ทุกช่องทาง</option>
          {(data?.filters.channels ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <a className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white" href={exportHref}>Export XLSX</a>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100"><tr><th className="p-2 text-left">PO Sell</th><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">Customer</th><th className="p-2 text-left">Channel</th><th className="p-2 text-left">สินค้า</th><th className="p-2 text-right">Sell Qty</th><th className="p-2 text-right">ราคา</th><th className="p-2 text-right">Revenue</th><th className="p-2 text-right">Matched Qty</th><th className="p-2 text-right">Avg Cost</th><th className="p-2 text-right">Cost</th><th className="p-2 text-right">Margin</th><th className="p-2 text-right">%</th><th className="p-2 text-center">Match Status</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td className="py-8 text-center text-slate-500" colSpan={14}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && (data?.rows.length ?? 0) === 0 ? <tr><td className="py-8 text-center text-slate-400" colSpan={14}>ยังไม่มี PO Sell</td></tr> : null}
            {!isLoading && (data?.rows ?? []).map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2 font-mono text-xs">{row.docNo}</td><td className="p-2">{row.date}</td><td className="p-2">{row.customer}</td><td className="p-2">{row.channel}</td><td className="p-2">{row.product}</td><td className="p-2 text-right">{formatMoney(row.sellQty)}</td><td className="p-2 text-right">{formatMoney(row.unitPrice)}</td><td className="p-2 text-right text-emerald-700">{formatMoney(row.totalRevenue)}</td><td className="p-2 text-right">{formatMoney(row.matchedQty)}</td><td className="p-2 text-right">{formatMoney(row.avgCost)}</td><td className="p-2 text-right text-red-600">{formatMoney(row.matchedCost)}</td><td className={`p-2 text-right font-bold ${row.margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatMoney(row.margin)}</td><td className={`p-2 text-right ${row.marginPct >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{row.marginPct.toFixed(2)}%</td><td className="p-2 text-center"><span className={`rounded px-2 py-0.5 text-xs ${row.statusMatch === 'Fully' ? 'bg-emerald-100 text-emerald-700' : row.statusMatch === 'Partial' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>{row.statusMatch}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function MatchStatusDonut({ fully, none, partial, total }: { fully: number; none: number; partial: number; total: number }) {
  const circumference = 440
  const fullyArc = total > 0 ? (fully / total) * circumference : 0
  const partialArc = total > 0 ? (partial / total) * circumference : 0
  const noneArc = total > 0 ? (none / total) * circumference : 0
  const fullyPct = total > 0 ? (fully / total) * 100 : 0

  return (
    <>
      <svg className="mx-auto block h-[140px] w-[140px]" viewBox="0 0 200 200" aria-label="Match status distribution" role="img">
        {total > 0 ? (
          <>
            <circle cx="100" cy="100" r="70" fill="none" stroke="#10b981" strokeDasharray={`${fullyArc} ${circumference}`} strokeWidth="40" transform="rotate(-90 100 100)" />
            <circle cx="100" cy="100" r="70" fill="none" stroke="#f59e0b" strokeDasharray={`${partialArc} ${circumference}`} strokeDashoffset={-fullyArc} strokeWidth="40" transform="rotate(-90 100 100)" />
            <circle cx="100" cy="100" r="70" fill="none" stroke="#94a3b8" strokeDasharray={`${noneArc} ${circumference}`} strokeDashoffset={-(fullyArc + partialArc)} strokeWidth="40" transform="rotate(-90 100 100)" />
          </>
        ) : null}
        <text x="100" y="95" textAnchor="middle" fontSize="10" fill="#64748b">{total} Deals</text>
        <text x="100" y="115" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#0f172a">{fullyPct.toFixed(0)}%</text>
      </svg>
      <div className="mt-1 flex justify-center gap-2 text-xs">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-500" />Fully</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-500" />Partial</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-400" />None</span>
      </div>
    </>
  )
}

function Metric({ label, tone, value }: { label: string; tone: 'emerald' | 'purple' | 'red'; value: string }) {
  const classes = {
    emerald: 'bg-white text-emerald-600',
    purple: 'bg-gradient-to-br from-purple-600 to-pink-700 text-white',
    red: 'bg-white text-red-600',
  }[tone]
  return <div className={`rounded-xl p-4 shadow ${classes}`}><div className="text-xs opacity-80">{label}</div><div className="text-2xl font-bold">{value}</div></div>
}
