'use client'

import { useCallback, useEffect, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type AccountRow = {
  accountNo: string
  balance: number
  bankName: string
  branchName: string
  code: string
  currency: string
  id: string
  name: string
  odLimit: number
  type: string
}

type DueRow = {
  aging: number
  balance: number
  bucket: string
  dueDate: string
  partyName: string
  refNo: string
}

type CashPositionPayload = {
  accounts: AccountRow[]
  byType: Array<{ accounts: number; balance: number; type: string }>
  exposure: {
    ap: { overdue: number; total: number; upcoming7: number }
    ar: { overdue: number; total: number; upcoming7: number }
  }
  nearDue: { ap: DueRow[]; ar: DueRow[] }
  summary: { accountBalance: number; accounts: number; netAfterAp: number; netExposure: number }
}

export function CashPositionPageClient() {
  const [data, setData] = useState<CashPositionPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      setData(await dailyFetchJson<CashPositionPayload>('/api/finance/cash-position'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลด Cash Position ไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-indigo-700 to-sky-700 p-5 text-white shadow">
        <h1 className="text-2xl font-bold">Cash Position</h1>
        <p className="mt-1 text-sm opacity-90">สรุปเงินสด/ธนาคารเทียบกับ AR/AP เพื่อดูสถานะเงินระยะสั้น</p>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="ยอดบัญชีรวม" value={formatMoney(data?.summary.accountBalance ?? 0)} />
        <Metric label="AR ค้างรับ" value={formatMoney(data?.exposure.ar.total ?? 0)} />
        <Metric label="AP ค้างจ่าย" value={formatMoney(data?.exposure.ap.total ?? 0)} />
        <Metric label="เงินหลังหัก AP" value={formatMoney(data?.summary.netAfterAp ?? 0)} />
        <Metric label="บัญชีเงิน" value={`${data?.summary.accounts ?? 0}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="text-base font-bold text-slate-900">สรุปตามประเภทบัญชี</h2>
          <div className="mt-3 space-y-2">
            {isLoading ? <div className="p-4 text-center text-sm text-slate-500">กำลังโหลดข้อมูล</div> : null}
            {!isLoading && (data?.byType ?? []).map((row) => (
              <div key={row.type} className="flex items-center justify-between rounded border border-slate-200 p-3">
                <div><div className="font-semibold">{row.type}</div><div className="text-xs text-slate-500">{row.accounts} บัญชี</div></div>
                <div className="font-bold">{formatMoney(row.balance)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="text-base font-bold text-slate-900">AR/AP ระยะสั้น</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MiniMetric label="AR เกินกำหนด" value={formatMoney(data?.exposure.ar.overdue ?? 0)} tone="green" />
            <MiniMetric label="AP เกินกำหนด" value={formatMoney(data?.exposure.ap.overdue ?? 0)} tone="red" />
            <MiniMetric label="AR ครบใน 7 วัน" value={formatMoney(data?.exposure.ar.upcoming7 ?? 0)} tone="green" />
            <MiniMetric label="AP ครบใน 7 วัน" value={formatMoney(data?.exposure.ap.upcoming7 ?? 0)} tone="red" />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr><th className="p-2 text-left">บัญชี</th><th className="p-2 text-left">ธนาคาร</th><th className="p-2 text-left">สาขา</th><th className="p-2 text-left">ประเภท</th><th className="p-2 text-right">OD Limit</th><th className="p-2 text-right">ยอดล่าสุด</th></tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={6}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && (data?.accounts ?? []).map((row) => (
              <tr key={row.id} className="border-t hover:bg-slate-50">
                <td className="p-2"><div className="font-medium">{row.name}</div><div className="font-mono text-xs text-slate-500">{row.accountNo || row.code || '-'}</div></td>
                <td className="p-2">{row.bankName || '-'}</td>
                <td className="p-2">{row.branchName}</td>
                <td className="p-2">{row.type}</td>
                <td className="p-2 text-right">{formatMoney(row.odLimit)}</td>
                <td className="p-2 text-right font-semibold">{formatMoney(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DueList title="AR ใกล้ครบกำหนด" rows={data?.nearDue.ar ?? []} tone="green" />
        <DueList title="AP ใกล้ครบกำหนด" rows={data?.nearDue.ap ?? []} tone="red" />
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white p-3 shadow"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-lg font-bold text-slate-900">{value}</div></div>
}

function MiniMetric({ label, tone, value }: { label: string; tone: 'green' | 'red'; value: string }) {
  const color = tone === 'green' ? 'text-emerald-700' : 'text-red-700'
  return <div className="rounded border border-slate-200 p-3"><div className="text-xs text-slate-500">{label}</div><div className={`mt-1 font-bold ${color}`}>{value}</div></div>
}

function DueList({ rows, title, tone }: { rows: DueRow[]; title: string; tone: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-emerald-700' : 'text-red-700'
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100"><tr><th className="p-2 text-left">เอกสาร</th><th className="p-2 text-left">คู่ค้า</th><th className="p-2 text-left">ครบกำหนด</th><th className="p-2 text-right">ยอด</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td className="p-4 text-center text-slate-500" colSpan={4}>ไม่มีรายการใกล้ครบกำหนด</td></tr> : null}
            {rows.map((row) => (
              <tr key={`${row.refNo}-${row.partyName}`} className="border-t">
                <td className="p-2 font-mono text-xs">{row.refNo}</td><td className="p-2">{row.partyName}</td><td className="p-2">{row.dueDate}</td><td className={`p-2 text-right font-semibold ${color}`}>{formatMoney(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
