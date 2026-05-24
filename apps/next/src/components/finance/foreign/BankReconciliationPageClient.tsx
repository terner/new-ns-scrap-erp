'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DatePickerInput } from '@/components/ui/date-picker-input'
import { dailyFetchJson, formatMoney } from '@/lib/daily'
import { formatDateDisplay } from '@/lib/format'

type AccountOption = { id: string; label: string; name: string }
type ErpRow = { date: string; id: string; in: number; out: number; refNo: string; type: string }
type ImportedRow = { date: string; desc: string; id: string; in: number; matchStatus: string; out: number }
type Payload = {
  designState: { importTable: string; matchState: string; writeBehavior: string }
  erpRows: ErpRow[]
  filters: { accounts: AccountOption[] }
  importedRows: ImportedRow[]
  stats: { erpUnmatched: number; ignored: number; matched: number; total: number; unmatched: number }
}

export function BankReconciliationPageClient() {
  const latestLoadRequestRef = useRef(0)
  const [accountId, setAccountId] = useState('')
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [toDate, setToDate] = useState('')

  const query = useMemo(() => {
    const params = new URLSearchParams()
    if (accountId) params.set('accountId', accountId)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    return params.toString()
  }, [accountId, fromDate, toDate])

  const loadData = useCallback(async () => {
    const requestId = latestLoadRequestRef.current + 1
    latestLoadRequestRef.current = requestId
    setError(null)
    setIsLoading(true)
    try {
      const payload = await dailyFetchJson<Payload>(`/api/finance/foreign/bank-reconciliation${query ? `?${query}` : ''}`)
      if (latestLoadRequestRef.current !== requestId) return
      setData(payload)
      if (!accountId && payload.filters.accounts[0]?.id) setAccountId(payload.filters.accounts[0].id)
    } catch (caught) {
      if (latestLoadRequestRef.current !== requestId) return
      setError(caught instanceof Error ? caught.message : 'โหลด Bank Reconciliation ไม่ได้')
    } finally {
      if (latestLoadRequestRef.current !== requestId) return
      setIsLoading(false)
    }
  }, [accountId, query])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <strong>Bank Reconciliation</strong> - Import Statement จากธนาคาร (CSV) แล้ว Auto-Match กับรายการใน ERP จากวันที่+จำนวนเงิน
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        <select className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm md:w-72" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          {(data?.filters.accounts ?? []).map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
        </select>
        <DatePickerInput ariaLabel="จากวันที่" className="w-[130px]" value={fromDate} onChange={setFromDate} />
        <DatePickerInput ariaLabel="ถึงวันที่" className="w-[130px]" value={toDate} onChange={setToDate} />
        <button className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white opacity-60" disabled type="button">Import CSV</button>
        <button className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white opacity-60" disabled type="button">Auto Match</button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Bank รายการรวม" value={data?.stats.total ?? 0} />
        <Stat label="Matched" tone="matched" value={data?.stats.matched ?? 0} />
        <Stat label="Bank Unmatched" tone="unmatched" value={data?.stats.unmatched ?? 0} />
        <Stat label="Ignored" tone="ignored" value={data?.stats.ignored ?? 0} />
        <Stat label="ERP ไม่มีใน Bank" tone="erp" value={data?.stats.erpUnmatched ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="Bank Statement (Imported)" tone="bank">
          <ImportedTable isLoading={isLoading} rows={data?.importedRows ?? []} />
        </Panel>
        <Panel title="ERP Bank Statement" tone="erp">
          <ErpTable isLoading={isLoading} rows={data?.erpRows ?? []} />
        </Panel>
      </div>
    </section>
  )
}

function Stat({ label, tone, value }: { label: string; tone?: 'matched' | 'unmatched' | 'ignored' | 'erp'; value: number }) {
  const styles = tone === 'matched' ? 'bg-emerald-50 text-emerald-700' : tone === 'unmatched' ? 'bg-amber-50 text-amber-700' : tone === 'erp' ? 'bg-red-50 text-red-700' : tone === 'ignored' ? 'bg-slate-100 text-slate-900' : 'bg-white text-slate-900'
  return <div className={`rounded-md p-3 shadow ${styles}`}><div className="text-xs opacity-80">{label}</div><div className="text-xl font-bold">{value}</div></div>
}

function Panel({ children, title, tone }: { children: React.ReactNode; title: string; tone: 'bank' | 'erp' }) {
  const heading = tone === 'bank' ? 'bg-blue-50' : 'bg-emerald-50'
  return <div className="overflow-hidden rounded-md bg-white shadow"><h3 className={`border-b px-4 py-3 font-semibold ${heading}`}>{title}</h3><div className="max-h-96 overflow-x-auto">{children}</div></div>
}

function ImportedTable({ isLoading, rows }: { isLoading: boolean; rows: ImportedRow[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-slate-100"><tr><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">รายละเอียด</th><th className="p-2 text-right">เข้า</th><th className="p-2 text-right">ออก</th><th className="p-2 text-center">Match</th><th></th></tr></thead>
      <tbody>
        {isLoading ? <tr><td className="py-6 text-center text-slate-400" colSpan={6}>กำลังโหลดข้อมูล</td></tr> : null}
        {!isLoading && rows.length === 0 ? <tr><td className="py-6 text-center text-slate-400" colSpan={6}>ยังไม่ได้ import statement</td></tr> : null}
      </tbody>
    </table>
  )
}

function ErpTable({ isLoading, rows }: { isLoading: boolean; rows: ErpRow[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-slate-100"><tr><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">ประเภท</th><th className="p-2 text-left">Ref</th><th className="p-2 text-right">เข้า</th><th className="p-2 text-right">ออก</th></tr></thead>
      <tbody>
        {isLoading ? <tr><td className="py-6 text-center text-slate-400" colSpan={5}>กำลังโหลดข้อมูล</td></tr> : null}
        {!isLoading && rows.length === 0 ? <tr><td className="py-6 text-center text-slate-400" colSpan={5}>ไม่มีรายการใน ERP</td></tr> : null}
        {!isLoading && rows.map((row) => (
          <tr key={row.id} className="border-t">
            <td className="p-2">{formatDateDisplay(row.date)}</td><td className="p-2">{row.type}</td><td className="p-2 font-mono text-blue-600">{row.refNo}</td><td className="p-2 text-right text-emerald-600">{row.in ? formatMoney(row.in) : '-'}</td><td className="p-2 text-right text-red-600">{row.out ? formatMoney(row.out) : '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
