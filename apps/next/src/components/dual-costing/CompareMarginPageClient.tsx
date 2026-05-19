'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type Totals = {
  cost: number
  margin: number
  marginPct: number
  revenue: number
  rows: number
}

type Payload = {
  dealTotals: Totals
  diff: { cost: number; margin: number; revenue: number }
  notes: string[]
  stockTotals: Totals
}

export function CompareMarginPageClient() {
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [toDate, setToDate] = useState('')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    return params.toString()
  }, [fromDate, toDate])

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      setData(await dailyFetchJson<Payload>(`/api/dual-costing/compare-margin?${queryString}`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลด Compare Margin ไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <section>
      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        เปรียบเทียบ <strong>Deal Margin</strong> (จาก PO Sell + Match Log) กับ <strong>Stock Margin</strong> (จากบิลขายจริง + WAC)
      </div>

      {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <MarginCard label="Deal Cost (จากการจองดีล)" tone="deal" totals={data?.dealTotals} />
        <MarginCard label="Stock Cost (จากบิลขายจริง + WAC)" tone="stock" totals={data?.stockTotals} />
      </div>

      <div className="mb-4 rounded-xl bg-white p-6 shadow">
        <h3 className="mb-3 font-semibold">⚖️ ส่วนต่าง Deal vs Stock</h3>
        <div className="grid grid-cols-1 gap-3 text-center md:grid-cols-3">
          <DiffCard label="Revenue Diff" goodWhenPositive value={data?.diff.revenue ?? 0} />
          <DiffCard label="Cost Diff" value={data?.diff.cost ?? 0} />
          <DiffCard label="Margin Diff (จริง - คาดการณ์)" goodWhenPositive prominent value={data?.diff.margin ?? 0} />
        </div>
        <div className="mt-4 text-xs text-slate-500">
          Margin Diff อาจมาจาก: ต้นทุนจริงต่างจาก Match, รับของบางส่วน, Grade Adjust, Production Loss, WAC เปลี่ยน, FX/Hedge PnL
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white/70 p-3 text-xs text-slate-500">
        <div className="flex flex-wrap gap-2">
          <input className="rounded border border-slate-200 bg-white px-2 py-1.5" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input className="rounded border border-slate-200 bg-white px-2 py-1.5" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
        <div className="flex flex-wrap gap-3">
          <span>Deal rows: <strong className="text-slate-700">{data?.dealTotals.rows ?? 0}</strong></span>
          <span>Sales bill rows: <strong className="text-slate-700">{data?.stockTotals.rows ?? 0}</strong></span>
        </div>
      </div>

      {isLoading ? <div className="mt-4 rounded-lg bg-white p-4 text-sm text-slate-500 shadow">กำลังโหลดข้อมูล</div> : null}
    </section>
  )
}

function MarginCard({ label, tone, totals }: { label: string; tone: 'deal' | 'stock'; totals?: Totals }) {
  const classes = tone === 'deal' ? 'from-purple-600 to-pink-700' : 'from-emerald-600 to-teal-700'
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${classes} p-6 text-white shadow`}>
      <div className="mb-2 text-sm opacity-80">{tone === 'deal' ? '💎 ' : '📊 '}{label}</div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span>{tone === 'deal' ? 'Total Revenue (PO Sell)' : 'Total Revenue (Sales Bills)'}</span><span className="font-bold">{formatMoney(totals?.revenue ?? 0)}</span></div>
        <div className="flex justify-between"><span>{tone === 'deal' ? 'Total Matched Cost' : 'Total COGS (จาก WAC)'}</span><span className="font-bold">{formatMoney(totals?.cost ?? 0)}</span></div>
        <div className="flex justify-between border-t border-white/30 pt-2 text-lg"><span className="font-semibold">{tone === 'deal' ? 'Gross Margin' : 'Gross Profit'}</span><span className="font-bold">{formatMoney(totals?.margin ?? 0)}</span></div>
        <div className="flex justify-between"><span>{tone === 'deal' ? 'Margin %' : 'GP %'}</span><span className="font-bold">{(totals?.marginPct ?? 0).toFixed(2)}%</span></div>
      </div>
    </div>
  )
}

function DiffCard({ goodWhenPositive = false, label, prominent = false, value }: { goodWhenPositive?: boolean; label: string; prominent?: boolean; value: number }) {
  const good = goodWhenPositive ? value >= 0 : value <= 0
  return <div className="rounded bg-slate-50 p-4"><div className="text-xs text-slate-500">{label}</div><div className={`${prominent ? 'text-2xl' : 'text-xl'} font-bold ${good ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(value)}</div></div>
}
