'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type ReceiptVoucherRow = {
  date: string
  docNo: string
  id: string
  licensePlate: string
  purchaseBillDocNo: string
  sellerName: string
  sellerPhone: string
  sellerTaxId: string
  totalAmount: number
  totalQty: number
}

export function ReceiptVouchersPageClient() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [rows, setRows] = useState<ReceiptVoucherRow[]>([])
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await dailyFetchJson<{ rows: ReceiptVoucherRow[] }>('/api/purchase/receipt-vouchers')
      setRows(payload.rows)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดใบสำคัญรับเงินไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => !query || `${row.docNo} ${row.purchaseBillDocNo} ${row.sellerName}`.toLowerCase().includes(query))
  }, [rows, search])

  return (
    <section className="space-y-4">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      <div className="rounded-lg bg-white p-4 shadow">
        <input className="w-full max-w-md rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหาเลขที่ / ผู้ขาย / บิลซื้อ" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <div className="flex text-sm text-slate-600">พบทั้งหมด <span className="mx-1 font-semibold text-slate-900">{filteredRows.length}</span> รายการ</div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100"><tr><th className="p-2 text-left">เลขที่</th><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">บิลซื้อ</th><th className="p-2 text-left">ผู้ขาย</th><th className="p-2 text-left">ทะเบียนรถ</th><th className="p-2 text-right">น้ำหนัก</th><th className="p-2 text-right">ยอดเงิน</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={7}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && filteredRows.map((row) => <tr key={row.id} className="border-t hover:bg-slate-50"><td className="p-2 font-mono text-xs">{row.docNo}</td><td className="p-2">{row.date}</td><td className="p-2 font-mono text-xs">{row.purchaseBillDocNo || '-'}</td><td className="p-2">{row.sellerName || '-'}</td><td className="p-2">{row.licensePlate || '-'}</td><td className="p-2 text-right">{formatMoney(row.totalQty)}</td><td className="p-2 text-right font-semibold">{formatMoney(row.totalAmount)}</td></tr>)}
            {!isLoading && filteredRows.length === 0 ? <tr><td className="p-6 text-center text-slate-500" colSpan={7}>ยังไม่มีรายการ</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}
