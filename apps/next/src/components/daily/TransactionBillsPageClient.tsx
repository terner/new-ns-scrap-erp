'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type BillRow = {
  branchName?: string
  channelName?: string
  customerName?: string
  date: string
  docNo: string
  grossProfit?: number
  id: string
  itemCount: number
  paidAmount?: number
  payableBalance?: number
  receivableBalance?: number
  receivedAmount?: number
  status: string
  supplierName?: string
  totalAmount?: number
  warehouseName?: string
}

type StockIssueRow = {
  branchName: string
  convertedToBillId: string
  customerName: string
  date: string
  docNo: string
  id: string
  itemCount: number
  status: string
  totalCost: number
  totalEstAmount: number
  warehouseName: string
}

type TransactionBillsPageClientProps = {
  mode: 'purchase' | 'sales' | 'stock-issue'
}

export function TransactionBillsPageClient({ mode }: TransactionBillsPageClientProps) {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [rows, setRows] = useState<Array<BillRow | StockIssueRow>>([])
  const [search, setSearch] = useState('')
  const apiPath = mode === 'purchase' ? '/api/purchase/bills' : mode === 'sales' ? '/api/sales/bills' : '/api/sales/stock-issue'

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await dailyFetchJson<{ rows: Array<BillRow | StockIssueRow> }>(apiPath)
      setRows(payload.rows)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [apiPath])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      const name = 'supplierName' in row ? row.supplierName : 'customerName' in row ? row.customerName : ''
      return !query || `${row.docNo} ${name ?? ''} ${row.branchName ?? ''} ${row.warehouseName ?? ''}`.toLowerCase().includes(query)
    })
  }, [rows, search])

  const total = filteredRows.reduce((sum, row) => sum + (isStockIssueRow(row) ? row.totalEstAmount : row.totalAmount ?? 0), 0)
  const title = mode === 'purchase' ? 'บิลรับซื้อ' : mode === 'sales' ? 'บิลขาย' : 'เบิกออกรอบิล'

  return (
    <section className="space-y-4">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <strong>{title}</strong> baseline นี้เป็นหน้ารายการอ่านข้อมูลจริงจาก DB ก่อน ส่วน create/post/void และ line refactor จะทำต่อใน transaction batch ถัดไปเพื่อไม่กระทบ stock/FIFO โดยไม่ตรวจ reconciliation
      </div>
      <div className="rounded-lg bg-white p-4 shadow">
        <input className="w-full max-w-md rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหาเลขที่ / ชื่อ / สาขา / คลัง" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <div>พบทั้งหมด <span className="font-semibold text-slate-900">{filteredRows.length}</span> รายการ · รวม <span className="font-semibold text-blue-700">{formatMoney(total)}</span></div>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">เลขที่</th>
              <th className="p-2 text-left">วันที่</th>
              <th className="p-2 text-left">{mode === 'purchase' ? 'ผู้ขาย' : 'ลูกค้า'}</th>
              <th className="p-2 text-left">สาขา / คลัง</th>
              <th className="p-2 text-center">สถานะ</th>
              <th className="p-2 text-right">รายการ</th>
              <th className="p-2 text-right">ยอดรวม</th>
              {mode !== 'stock-issue' ? <th className="p-2 text-right">ค้างชำระ</th> : null}
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={mode === 'stock-issue' ? 7 : 8}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && filteredRows.map((row) => (
              <tr key={row.id} className="border-t hover:bg-slate-50">
                <td className="p-2 font-mono text-xs">{row.docNo}</td>
                <td className="p-2">{row.date}</td>
                <td className="p-2">{'supplierName' in row ? row.supplierName : row.customerName}</td>
                <td className="p-2">{row.branchName ?? '-'} / {row.warehouseName ?? '-'}</td>
                <td className="p-2 text-center"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{row.status}</span></td>
                <td className="p-2 text-right">{row.itemCount}</td>
                <td className="p-2 text-right font-semibold">{formatMoney(isStockIssueRow(row) ? row.totalEstAmount : row.totalAmount ?? 0)}</td>
                {mode !== 'stock-issue' && !isStockIssueRow(row) ? <td className="p-2 text-right text-red-700">{formatMoney(mode === 'purchase' ? row.payableBalance ?? 0 : row.receivableBalance ?? 0)}</td> : null}
              </tr>
            ))}
            {!isLoading && filteredRows.length === 0 ? <tr><td className="p-6 text-center text-slate-500" colSpan={mode === 'stock-issue' ? 7 : 8}>ยังไม่มีรายการ</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function isStockIssueRow(row: BillRow | StockIssueRow): row is StockIssueRow {
  return 'totalEstAmount' in row
}
