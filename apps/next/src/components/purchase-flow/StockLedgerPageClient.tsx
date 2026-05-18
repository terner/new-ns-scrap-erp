'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type StockLedgerPayload = {
  page: number
  pageSize: number
  rows: Array<{ branchName: string; counterpartyName: string; date: string; id: string; lotNo: string; movementType: string; notAvailableForSale: boolean; outputCategory: string; productCode: string; productId: string; productName: string; qtyIn: number; qtyOut: number; refNo: string; refType: string; runningBalanceByProduct: number; unitCost: number; valueIn: number; valueOut: number; warehouseName: string }>
  summary: { count: number; pageCount: number; qtyIn: number; qtyOut: number; valueIn: number; valueOut: number }
  total: number
}

export function StockLedgerPageClient() {
  const [balanceMode, setBalanceMode] = useState<'product' | 'warehouse'>('product')
  const [data, setData] = useState<StockLedgerPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filterRefType, setFilterRefType] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [negativeOnly, setNegativeOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [toDate, setToDate] = useState('')

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ balanceMode, page: String(page), pageSize: '80' })
      if (filterRefType) params.set('refType', filterRefType)
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      if (negativeOnly) params.set('negativeOnly', 'true')
      setData(await dailyFetchJson<StockLedgerPayload>(`/api/stock/ledger?${params.toString()}`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลด Stock Ledger ไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [balanceMode, filterRefType, fromDate, negativeOnly, page, toDate])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (data?.rows ?? []).filter((row) => !query || `${row.refNo} ${row.productCode} ${row.productName} ${row.counterpartyName} ${row.branchName} ${row.warehouseName}`.toLowerCase().includes(query))
  }, [data?.rows, search])

  function exportXlsx() {
    const params = new URLSearchParams({ balanceMode, format: 'xlsx', page: '1', pageSize: '500' })
    if (filterRefType) params.set('refType', filterRefType)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    window.location.href = `/api/stock/ledger?${params.toString()}`
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 80)))

  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 p-5 text-white shadow">
        <h1 className="text-2xl font-bold">Stock Ledger</h1>
        <p className="mt-1 text-sm opacity-90">ตรวจ movement ทุกประเภทพร้อม running balance และ export สำหรับ reconciliation</p>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="รายการ" value={`${data?.summary.count ?? 0}`} />
        <Metric label="รับเข้า" value={formatMoney(data?.summary.qtyIn ?? 0)} />
        <Metric label="จ่ายออก" value={formatMoney(data?.summary.qtyOut ?? 0)} />
        <Metric label="มูลค่ารับเข้า" value={formatMoney(data?.summary.valueIn ?? 0)} />
        <Metric label="มูลค่าจ่ายออก" value={formatMoney(data?.summary.valueOut ?? 0)} />
      </div>
      <div className="rounded-lg bg-white p-3 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <select className="rounded-lg border px-3 py-2 text-sm" value={filterRefType} onChange={(event) => setFilterRefType(event.target.value)}>
            <option value="">ทุก Ref Type</option>
            <option value="PB">PB - บิลรับซื้อ</option>
            <option value="SB">SB - บิลขาย</option>
            <option value="ST">ST - โอนสินค้า</option>
            <option value="SC">SC - ปรับสถานะ</option>
            <option value="GA">GA - ปรับเกรด</option>
            <option value="ADJ">ADJ - นับสต๊อก</option>
            <option value="CR">CR - ของคืนลูกค้า</option>
          </select>
          <input className="rounded-lg border px-3 py-2 text-sm" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input className="rounded-lg border px-3 py-2 text-sm" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          <input className="min-w-64 flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหาเลขเอกสาร / สินค้า / คู่ค้า / สาขา" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="inline-flex overflow-hidden rounded-lg border text-xs">
            <button className={balanceMode === 'product' ? 'bg-blue-600 px-3 py-2 font-bold text-white' : 'px-3 py-2 font-bold text-slate-600'} type="button" onClick={() => setBalanceMode('product')}>ต่อสินค้า</button>
            <button className={balanceMode === 'warehouse' ? 'bg-blue-600 px-3 py-2 font-bold text-white' : 'border-l px-3 py-2 font-bold text-slate-600'} type="button" onClick={() => setBalanceMode('warehouse')}>ต่อคลัง</button>
          </div>
          <button className={negativeOnly ? 'rounded bg-red-600 px-3 py-2 text-xs font-bold text-white' : 'rounded bg-red-50 px-3 py-2 text-xs font-bold text-red-700'} type="button" onClick={() => setNegativeOnly(!negativeOnly)}>ติดลบ</button>
          <button className="rounded bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700" type="button" onClick={() => void loadData()}>Refresh</button>
          <button className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white" type="button" onClick={exportXlsx}>Export .xlsx</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">Ref</th><th className="p-2 text-left">Movement</th><th className="p-2 text-left">สินค้า</th><th className="p-2 text-left">คู่ค้า</th><th className="p-2 text-left">สาขา / คลัง</th><th className="p-2 text-left">Lot/Status</th><th className="p-2 text-right">เข้า</th><th className="p-2 text-right">ออก</th><th className="p-2 text-right">ราคา</th><th className="p-2 text-right">คงเหลือ</th></tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={11}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && rows.map((row) => (
              <tr key={row.id} className={row.runningBalanceByProduct < 0 ? 'border-t bg-red-50/70' : 'border-t hover:bg-slate-50'}>
                <td className="p-2">{row.date}</td><td className="p-2 font-mono text-xs">{row.refType}:{row.refNo || '-'}</td><td className="p-2">{row.movementType}</td><td className="p-2">{row.productCode ? `${row.productCode} · ` : ''}{row.productName}</td><td className="p-2">{row.counterpartyName}</td><td className="p-2">{row.branchName} / {row.warehouseName}</td><td className="p-2 text-xs">{row.lotNo || '-'}<div>{row.outputCategory || '-'}</div></td><td className="p-2 text-right text-emerald-700">{formatMoney(row.qtyIn)}</td><td className="p-2 text-right text-red-700">{formatMoney(row.qtyOut)}</td><td className="p-2 text-right">{formatMoney(row.unitCost)}</td><td className="p-2 text-right font-semibold">{formatMoney(row.runningBalanceByProduct)}</td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 ? <tr><td className="p-8 text-center text-slate-400" colSpan={11}>ไม่พบ Stock Movement ตามเงื่อนไข</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>หน้า {page} / {totalPages} · ทั้งหมด {data?.total ?? 0} รายการ</span>
        <div className="flex gap-2">
          <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={page <= 1} type="button" onClick={() => setPage((value) => Math.max(1, value - 1))}>ก่อนหน้า</button>
          <button className="rounded border px-3 py-1 disabled:opacity-40" disabled={page >= totalPages} type="button" onClick={() => setPage((value) => value + 1)}>ถัดไป</button>
        </div>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white p-3 shadow"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-lg font-bold text-slate-900">{value}</div></div>
}
