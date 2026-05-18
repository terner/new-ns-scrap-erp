'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type ApprovalPayload = {
  apRows: Array<{ bankAccount: string; bankName: string; date: string; docNo: string; id: string; paidAmount: number; payableBalance: number; supplierName: string; totalAmount: number }>
  expenseRows: Array<{ accountName: string; date: string; docNo: string; dueDate: string; id: string; payee: string; refDocNo: string; totalAmount: number }>
}

export function PaymentApprovalPageClient() {
  const [data, setData] = useState<ApprovalPayload>({ apRows: [], expenseRows: [] })
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'ap' | 'expense'>('ap')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await dailyFetchJson<ApprovalPayload>('/api/daily/payment-approval'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดรายการอนุมัติไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const source = tab === 'ap' ? data.apRows : data.expenseRows
    return source.filter((row) => !query || `${row.docNo} ${'supplierName' in row ? row.supplierName : row.payee}`.toLowerCase().includes(query))
  }, [data.apRows, data.expenseRows, search, tab])

  return (
    <section className="space-y-4">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      <div className="rounded-lg bg-white p-4 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <button className={`rounded px-4 py-2 text-sm font-semibold ${tab === 'ap' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`} type="button" onClick={() => setTab('ap')}>บิลซื้อค้างจ่าย ({data.apRows.length})</button>
          <button className={`rounded px-4 py-2 text-sm font-semibold ${tab === 'expense' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`} type="button" onClick={() => setTab('expense')}>ค่าใช้จ่ายค้างจ่าย ({data.expenseRows.length})</button>
          <input className="ml-auto min-w-56 rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหา..." type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>
      <div className="flex text-sm text-slate-600">พบทั้งหมด <span className="mx-1 font-semibold text-slate-900">{rows.length}</span> รายการ · รวม <span className="ml-1 font-semibold text-blue-700">{formatMoney(rows.reduce((sum, row) => sum + ('payableBalance' in row ? row.payableBalance : row.totalAmount), 0))}</span></div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">เลขที่</th>
              <th className="p-2 text-left">วันที่</th>
              <th className="p-2 text-left">ชื่อ</th>
              <th className="p-2 text-left">บัญชี/อ้างอิง</th>
              <th className="p-2 text-right">ยอดค้าง/ยอดจ่าย</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={5}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && rows.map((row) => (
              <tr key={row.id} className="border-t hover:bg-slate-50">
                <td className="p-2 font-mono text-xs">{row.docNo}</td>
                <td className="p-2">{row.date}</td>
                <td className="p-2 font-medium">{'supplierName' in row ? row.supplierName : row.payee}</td>
                <td className="p-2">{'bankAccount' in row ? [row.bankName, row.bankAccount].filter(Boolean).join(' / ') || '-' : row.refDocNo || row.accountName || '-'}</td>
                <td className="p-2 text-right font-semibold">{formatMoney('payableBalance' in row ? row.payableBalance : row.totalAmount)}</td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 ? <tr><td className="p-6 text-center text-slate-500" colSpan={5}>ไม่มีรายการ</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
