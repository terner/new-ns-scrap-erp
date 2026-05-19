'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type MatchLogRow = {
  allocationMode: string
  costType: string
  date: string
  id: string
  matchId: string
  matchType: string
  product: string
  qtyUsed: number
  sourceNo: string
  sourceType: string
  status: string
  target: string
  totalCost: number
  unitCost: number
}

type Payload = {
  filters: { costTypes: string[]; matchTypes: string[]; statuses: string[] }
  rows: MatchLogRow[]
  summary: { active: number; reversed: number; sales: number; total: number; totalCost: number; totalQty: number }
}

export function MatchLogPageClient() {
  const [costType, setCostType] = useState('all')
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [matchType, setMatchType] = useState('all')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (costType !== 'all') params.set('costType', costType)
    if (matchType !== 'all') params.set('matchType', matchType)
    if (search.trim()) params.set('q', search.trim())
    if (status !== 'all') params.set('status', status)
    return params.toString()
  }, [costType, matchType, search, status])

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      setData(await dailyFetchJson<Payload>(`/api/dual-costing/match-log?${queryString}`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลด Match Log ไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const exportHref = `/api/dual-costing/match-log?${queryString ? `${queryString}&` : ''}format=xlsx`

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
        <strong>Match Log</strong> - บันทึกการตัดต้นทุนจาก Cost Pool ห้ามลบ - ใช้ Reverse แทน<br />
        <span className="text-xs">Batch นี้อ่านจาก Trading Deals ที่มีอยู่เท่านั้น; allocation log/reverse จริงยัง deferred</span>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <Metric label="รวม Matches" value={String(data?.summary.total ?? 0)} />
        <Metric label="Sales Match" tone="emerald" value={String(data?.summary.sales ?? 0)} />
        <Metric label="Regrade Match" tone="purple" value="0" />
        <Metric label="Active" tone="emerald" value={String(data?.summary.active ?? 0)} />
        <Metric label="รวม Qty" value={formatMoney(data?.summary.totalQty ?? 0)} />
        <Metric label="รวมมูลค่าต้นทุน" value={formatMoney(data?.summary.totalCost ?? 0)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input className="w-64 rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหา match_id / source / GA..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="rounded-lg border bg-amber-50 px-3 py-2 text-sm font-medium" value={matchType} onChange={(event) => setMatchType(event.target.value)}>
          <option value="all">ทุก Match Type</option>
          {(data?.filters.matchTypes ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="rounded-lg border px-3 py-2 text-sm" value={costType} onChange={(event) => setCostType(event.target.value)}>
          <option value="all">ทุก Cost Type</option>
          {(data?.filters.costTypes ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select className="rounded-lg border px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">ทุกสถานะ</option>
          {(data?.filters.statuses ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <a className="ml-auto rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white" href={exportHref}>Export XLSX</a>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100"><tr><th className="p-2 text-left">Match Type</th><th className="p-2 text-left">Cost Type</th><th className="p-2 text-left">Match ID</th><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">Target / Reference</th><th className="p-2 text-left">Source</th><th className="p-2 text-left">Source No</th><th className="p-2 text-left">สินค้า</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">฿/หน่วย</th><th className="p-2 text-right">มูลค่า</th><th className="p-2 text-center">Mode</th><th className="p-2 text-center">สถานะ</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td className="py-8 text-center text-slate-500" colSpan={13}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && (data?.rows.length ?? 0) === 0 ? <tr><td className="py-8 text-center text-slate-400" colSpan={13}>ยังไม่มี Match Log ตามตัวกรอง</td></tr> : null}
            {!isLoading && (data?.rows ?? []).map((row) => (
              <tr key={row.id} className={`border-t ${row.status === 'reversed' ? 'opacity-50' : ''}`}>
                <td className="p-2"><span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Sales</span></td>
                <td className="p-2"><span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700">{row.costType}</span></td>
                <td className="p-2 font-mono text-xs">{row.matchId}</td>
                <td className="p-2 text-xs">{row.date}</td>
                <td className="p-2 text-xs">{row.target}</td>
                <td className="p-2"><span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700">{row.sourceType}</span></td>
                <td className="p-2 font-mono text-xs">{row.sourceNo}</td>
                <td className="p-2 text-xs">{row.product}</td>
                <td className="p-2 text-right">{formatMoney(row.qtyUsed)}</td>
                <td className="p-2 text-right">{formatMoney(row.unitCost)}</td>
                <td className="p-2 text-right font-medium">{formatMoney(row.totalCost)}</td>
                <td className="p-2 text-center text-xs">{row.allocationMode}</td>
                <td className="p-2 text-center"><span className={`rounded px-2 py-0.5 text-[10px] ${row.status === 'reversed' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Metric({ label, tone = 'normal', value }: { label: string; tone?: 'emerald' | 'normal' | 'purple'; value: string }) {
  const classes = {
    emerald: 'bg-emerald-50 text-emerald-700',
    normal: 'bg-white text-slate-900',
    purple: 'bg-purple-50 text-purple-700',
  }[tone]
  return <div className={`rounded-lg p-3 shadow ${classes}`}><div className="text-[10px] opacity-70">{label}</div><div className="text-xl font-bold">{value}</div></div>
}
