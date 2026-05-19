'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type CustomerTrackingPayload = {
  filters: { customers: Array<{ active: boolean | null; code: string | null; id: string; name: string }> }
  monthly: Array<{ gp: number; month: string; qty: number; revenue: number }>
  rows: Array<{ avgSell: number; billCount: number; code: string; cogs: number; customerName: string; gp: number; gpPct: number; id: string; profitPerKg: number; qty: number; receivable: number; receivedAmount: number; revenue: number }>
  summary: { cogs: number; customers: number; gp: number; qty: number; receivable: number; receivedAmount: number; revenue: number }
  year: string
}

const monthLabels = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

export function CustomerTrackingPageClient() {
  const [customerId, setCustomerId] = useState('')
  const [data, setData] = useState<CustomerTrackingPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [month, setMonth] = useState('')
  const [search, setSearch] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ year })
    if (month) params.set('month', month)
    if (customerId) params.set('customerId', customerId)
    if (search.trim()) params.set('q', search.trim())
    return params.toString()
  }, [customerId, month, search, year])

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      setData(await dailyFetchJson<CustomerTrackingPayload>(`/api/tracking/customer?${queryString}`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลด Customer Tracking ไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rows = data?.rows ?? []
  const maxMonthRevenue = Math.max(1, ...(data?.monthly ?? []).map((item) => item.revenue))
  const exportHref = `/api/tracking/customer?${queryString}&format=xlsx`

  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 p-5 text-white shadow">
        <h1 className="text-2xl font-bold">Customer Tracking 360°</h1>
        <p className="mt-1 text-sm opacity-90">วิเคราะห์ลูกค้าจากบิลขาย ใบรับเงิน ลูกหนี้ และกำไรขั้นต้น</p>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      <div className="rounded-lg bg-white p-3 shadow">
        <div className="grid gap-2 md:grid-cols-6">
          <input className="rounded-lg border px-3 py-2 text-sm" type="number" value={year} onChange={(event) => setYear(event.target.value)} />
          <select className="rounded-lg border px-3 py-2 text-sm" value={month} onChange={(event) => setMonth(event.target.value)}>
            <option value="">ทั้งปี</option>
            {months.map((value, index) => <option key={value} value={value}>{monthLabels[index]}</option>)}
          </select>
          <select className="rounded-lg border px-3 py-2 text-sm md:col-span-2" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">ลูกค้าทั้งหมด</option>
            {(data?.filters.customers ?? []).map((customer) => <option key={customer.id} value={customer.id}>{customer.code ? `${customer.code} - ${customer.name}` : customer.name}</option>)}
          </select>
          <input className="rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหา Customer" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          <a className="rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white" href={exportHref}>Export XLSX</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <Metric label="ยอดขาย" value={formatMoney(data?.summary.revenue ?? 0)} tone="emerald" />
        <Metric label="น้ำหนัก" value={formatMoney(data?.summary.qty ?? 0)} />
        <Metric label="COGS" value={formatMoney(data?.summary.cogs ?? 0)} />
        <Metric label="GP" value={formatMoney(data?.summary.gp ?? 0)} tone="emerald" />
        <Metric label="รับเงิน" value={formatMoney(data?.summary.receivedAmount ?? 0)} />
        <Metric label="ลูกหนี้" value={formatMoney(data?.summary.receivable ?? 0)} tone="amber" />
        <Metric label="Customer" value={`${data?.summary.customers ?? 0}`} />
      </div>

      <div className="rounded-lg bg-white p-4 shadow">
        <div className="mb-3 text-sm font-semibold text-slate-700">ยอดขายรายเดือน {data?.year ?? year}</div>
        <div className="grid grid-cols-12 items-end gap-2">
          {(data?.monthly ?? []).map((item, index) => (
            <div key={item.month} className="flex min-h-40 flex-col items-center justify-end gap-1">
              <div className="w-full rounded-t bg-emerald-500" style={{ height: `${Math.max(4, (item.revenue / maxMonthRevenue) * 128)}px` }} />
              <div className="text-[10px] text-slate-500">{monthLabels[index]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">Customer</th>
              <th className="p-2 text-right">บิล</th>
              <th className="p-2 text-right">น้ำหนัก</th>
              <th className="p-2 text-right">ยอดขาย</th>
              <th className="p-2 text-right">ราคาเฉลี่ย</th>
              <th className="p-2 text-right">COGS</th>
              <th className="p-2 text-right">GP</th>
              <th className="p-2 text-right">GP%</th>
              <th className="p-2 text-right">รับเงิน</th>
              <th className="p-2 text-right">ลูกหนี้</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={10}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && rows.length === 0 ? <tr><td className="p-8 text-center text-slate-400" colSpan={10}>ไม่มีข้อมูล Customer Tracking</td></tr> : null}
            {!isLoading && rows.map((row) => (
              <tr key={row.id} className="border-t hover:bg-slate-50">
                <td className="p-2"><div className="font-medium">{row.customerName}</div><div className="text-xs text-slate-500">{row.code || '-'}</div></td>
                <td className="p-2 text-right">{row.billCount}</td>
                <td className="p-2 text-right">{formatMoney(row.qty)}</td>
                <td className="p-2 text-right font-semibold text-emerald-700">{formatMoney(row.revenue)}</td>
                <td className="p-2 text-right">{formatMoney(row.avgSell)}</td>
                <td className="p-2 text-right text-red-700">{formatMoney(row.cogs)}</td>
                <td className={`p-2 text-right font-semibold ${row.gp >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatMoney(row.gp)}</td>
                <td className="p-2 text-right">{row.gpPct.toFixed(2)}%</td>
                <td className="p-2 text-right">{formatMoney(row.receivedAmount)}</td>
                <td className="p-2 text-right text-amber-700">{formatMoney(row.receivable)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Metric({ label, tone, value }: { label: string; tone?: 'amber' | 'emerald'; value: string }) {
  const color = tone === 'emerald' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-700' : 'text-slate-900'
  return <div className="rounded-lg bg-white p-3 shadow"><div className="text-xs text-slate-500">{label}</div><div className={`mt-1 text-lg font-bold ${color}`}>{value}</div></div>
}
