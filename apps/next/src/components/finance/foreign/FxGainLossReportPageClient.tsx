'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type FxGainLossRow = {
  currency: string
  date: string
  foreignAmount: number
  fxGainLossAmount: number
  id: string
  notes: string
  originalFxRate: number
  originalThbValue: number
  reference: string
  settlementFxRate: number
  settlementThbValue: number
  transactionType: string
}

type FxGainLossPayload = {
  filters: { currencies: string[]; refTypes: string[] }
  rows: FxGainLossRow[]
  summary: { net: number; rows: number; totalGain: number; totalLoss: number }
}

export function FxGainLossReportPageClient() {
  const [currency, setCurrency] = useState('all')
  const [data, setData] = useState<FxGainLossPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [refType, setRefType] = useState('all')
  const [toDate, setToDate] = useState('')

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    if (currency !== 'all') params.set('currency', currency)
    if (refType !== 'all') params.set('refType', refType)
    return params.toString()
  }, [currency, fromDate, refType, toDate])

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      setData(await dailyFetchJson<FxGainLossPayload>(`/api/finance/foreign/fx-gain-loss-report${query ? `?${query}` : ''}`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลด FX Gain/Loss ไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [query])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <strong>FX Gain/Loss</strong> - Realized FX Gain/Loss จากการรับ-จ่ายเงินต่างประเทศจริง (ส่วนต่างระหว่าง FX rate ตอนตั้ง AR/AP กับตอนรับ/จ่ายจริง)
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        <input aria-label="จากวันที่" className="rounded-md border border-slate-200 px-3 py-2 text-sm" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
        <input aria-label="ถึงวันที่" className="rounded-md border border-slate-200 px-3 py-2 text-sm" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        <select aria-label="สกุลเงิน" className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={currency} onChange={(event) => setCurrency(event.target.value)}>
          <option value="all">ทุกสกุล</option>
          {(data?.filters.currencies ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select aria-label="ประเภท" className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={refType} onChange={(event) => setRefType(event.target.value)}>
          <option value="all">ทุกประเภท</option>
          {(data?.filters.refTypes ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard label="FX Gain รวม" tone="gain" value={data?.summary.totalGain ?? 0} />
        <MetricCard label="FX Loss รวม" tone="loss" value={data?.summary.totalLoss ?? 0} />
        <MetricCard label="Net FX G/L" tone="net" value={data?.summary.net ?? 0} />
      </div>

      <div className="overflow-x-auto rounded-md bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">วันที่</th>
              <th className="p-2 text-left">ประเภท</th>
              <th className="p-2 text-left">Reference</th>
              <th className="p-2 text-left">สกุล</th>
              <th className="p-2 text-right">Foreign Amount</th>
              <th className="p-2 text-right">Original Rate</th>
              <th className="p-2 text-right">Settlement Rate</th>
              <th className="p-2 text-right">Original THB</th>
              <th className="p-2 text-right">Settlement THB</th>
              <th className="p-2 text-right">FX G/L</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={10}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && (data?.rows.length ?? 0) === 0 ? <tr><td className="py-8 text-center text-slate-400" colSpan={10}>ยังไม่มี FX Gain/Loss</td></tr> : null}
            {!isLoading && data?.rows.map((row) => (
              <tr key={row.id} className="border-t hover:bg-slate-50">
                <td className="p-2">{row.date}</td>
                <td className="p-2 text-xs">{row.transactionType}</td>
                <td className="p-2 font-mono text-xs">{row.reference}</td>
                <td className="p-2">{row.currency || '-'}</td>
                <td className="p-2 text-right">{formatMoney(row.foreignAmount)}</td>
                <td className="p-2 text-right">{formatMoney(row.originalFxRate)}</td>
                <td className="p-2 text-right">{formatMoney(row.settlementFxRate)}</td>
                <td className="p-2 text-right">{formatMoney(row.originalThbValue)}</td>
                <td className="p-2 text-right">{formatMoney(row.settlementThbValue)}</td>
                <td className={`p-2 text-right font-bold ${row.fxGainLossAmount >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatMoney(row.fxGainLossAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function MetricCard({ label, tone, value }: { label: string; tone: 'gain' | 'loss' | 'net'; value: number }) {
  if (tone === 'net') {
    return <div className="rounded-md bg-gradient-to-br from-blue-600 to-indigo-700 p-4 text-white shadow"><div className="text-xs opacity-80">{label}</div><div className="text-2xl font-bold">{formatMoney(value)}</div></div>
  }
  const colors = tone === 'gain' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
  const labelColor = tone === 'gain' ? 'text-emerald-600' : 'text-red-600'
  return <div className={`rounded-md p-4 shadow ${colors}`}><div className={`text-xs ${labelColor}`}>{label}</div><div className="text-2xl font-bold">{formatMoney(value)}</div></div>
}
