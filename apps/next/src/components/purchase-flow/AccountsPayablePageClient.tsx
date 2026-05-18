'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type ApRow = {
  aging: number
  bucket: string
  channelName: string
  date: string
  docNo: string
  dueDate: string
  id: string
  paidAmount: number
  payableBalance: number
  supplierName: string
  totalAmount: number
  transactionMode: string
}

type ApPayload = {
  byBucket: Array<{ bucket: string; bills: number; total: number }>
  bySupplier: Array<{ bills: number; current: number; gt90: number; oldest: number; supplierName: string; total: number; b30: number; b60: number; b90: number }>
  rows: ApRow[]
  summary: { bills: number; dueIn7: number; overdue: number; suppliers: number; total: number }
}

function bucketClass(bucket: string) {
  if (bucket === 'Current') return 'bg-slate-100 text-slate-700'
  if (bucket === '1-30') return 'bg-yellow-100 text-yellow-800'
  if (bucket === '31-60') return 'bg-amber-100 text-amber-800'
  if (bucket === '61-90') return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

export function AccountsPayablePageClient() {
  const [data, setData] = useState<ApPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'summary' | 'detail'>('summary')

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      setData(await dailyFetchJson<ApPayload>('/api/finance/ap'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลด AP ไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (data?.rows ?? []).filter((row) => !query || `${row.docNo} ${row.supplierName} ${row.channelName}`.toLowerCase().includes(query))
  }, [data?.rows, search])

  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-red-700 to-rose-700 p-5 text-white shadow">
        <h1 className="text-2xl font-bold">รายการค้างจ่าย / Accounts Payable</h1>
        <p className="mt-1 text-sm opacity-90">อ่านจากบิลรับซื้อและรายการจ่ายเงิน Supplier เพื่อดูยอดค้างจริงตาม flow legacy</p>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="ค้างจ่ายรวม" value={formatMoney(data?.summary.total ?? 0)} />
        <Metric label="เกินกำหนด" value={formatMoney(data?.summary.overdue ?? 0)} />
        <Metric label="ครบใน 7 วัน" value={formatMoney(data?.summary.dueIn7 ?? 0)} />
        <Metric label="บิลค้างจ่าย" value={`${data?.summary.bills ?? 0}`} />
        <Metric label="Supplier" value={`${data?.summary.suppliers ?? 0}`} />
      </div>
      <div className="rounded-lg bg-white p-3 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <button className={`rounded px-4 py-2 text-sm ${tab === 'summary' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`} type="button" onClick={() => setTab('summary')}>สรุปตาม Supplier</button>
          <button className={`rounded px-4 py-2 text-sm ${tab === 'detail' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`} type="button" onClick={() => setTab('detail')}>รายบิล</button>
          <input className="ml-auto min-w-64 rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหาเลขบิล / ผู้ขาย / ช่องทาง" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>
      {tab === 'summary' ? (
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr><th className="p-2 text-left">Supplier</th><th className="p-2 text-right">บิล</th><th className="p-2 text-right">Current</th><th className="p-2 text-right">1-30</th><th className="p-2 text-right">31-60</th><th className="p-2 text-right">61-90</th><th className="p-2 text-right">&gt;90</th><th className="p-2 text-right">รวม</th></tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={8}>กำลังโหลดข้อมูล</td></tr> : null}
              {!isLoading && (data?.bySupplier ?? []).map((row) => (
                <tr key={row.supplierName} className="border-t hover:bg-slate-50">
                  <td className="p-2 font-medium">{row.supplierName}</td><td className="p-2 text-right">{row.bills}</td><td className="p-2 text-right">{formatMoney(row.current)}</td><td className="p-2 text-right">{formatMoney(row.b30)}</td><td className="p-2 text-right">{formatMoney(row.b60)}</td><td className="p-2 text-right">{formatMoney(row.b90)}</td><td className="p-2 text-right">{formatMoney(row.gt90)}</td><td className="p-2 text-right font-semibold text-red-700">{formatMoney(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr><th className="p-2 text-left">เลขที่</th><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">ครบกำหนด</th><th className="p-2 text-left">ผู้ขาย</th><th className="p-2 text-center">อายุหนี้</th><th className="p-2 text-right">ยอดบิล</th><th className="p-2 text-right">จ่ายแล้ว</th><th className="p-2 text-right">ค้างจ่าย</th></tr>
            </thead>
            <tbody>
              {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={8}>กำลังโหลดข้อมูล</td></tr> : null}
              {!isLoading && rows.map((row) => (
                <tr key={row.id} className="border-t hover:bg-slate-50">
                  <td className="p-2 font-mono text-xs">{row.docNo}</td><td className="p-2">{row.date}</td><td className="p-2">{row.dueDate}</td><td className="p-2">{row.supplierName}</td><td className="p-2 text-center"><span className={`rounded-full px-2 py-0.5 text-xs ${bucketClass(row.bucket)}`}>{row.bucket}</span></td><td className="p-2 text-right">{formatMoney(row.totalAmount)}</td><td className="p-2 text-right">{formatMoney(row.paidAmount)}</td><td className="p-2 text-right font-semibold text-red-700">{formatMoney(row.payableBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white p-3 shadow"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-lg font-bold text-slate-900">{value}</div></div>
}
