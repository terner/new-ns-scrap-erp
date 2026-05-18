'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type StockLedgerPayload = {
  rows: Array<{ branchName: string; counterpartyName: string; date: string; id: string; movementType: string; productCode: string; productName: string; qtyIn: number; qtyOut: number; refNo: string; refType: string; runningBalanceByProduct: number; unitCost: number; valueIn: number; valueOut: number; warehouseName: string }>
  summary: { count: number; qtyIn: number; qtyOut: number; valueIn: number; valueOut: number }
}

export function StockLedgerPageClient() {
  const [data, setData] = useState<StockLedgerPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filterRefType, setFilterRefType] = useState('PB')
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ limit: '3000' })
      if (filterRefType) params.set('refType', filterRefType)
      setData(await dailyFetchJson<StockLedgerPayload>(`/api/stock/ledger?${params.toString()}`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลด Stock Ledger ไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [filterRefType])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (data?.rows ?? []).filter((row) => !query || `${row.refNo} ${row.productCode} ${row.productName} ${row.counterpartyName} ${row.branchName} ${row.warehouseName}`.toLowerCase().includes(query))
  }, [data?.rows, search])

  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 p-5 text-white shadow">
        <h1 className="text-2xl font-bold">Stock Ledger</h1>
        <p className="mt-1 text-sm opacity-90">ตรวจ movement ที่เกิดจากบิลรับซื้อ `PB` และ transaction อื่นที่เข้า/ออกคลัง</p>
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
          </select>
          <input className="min-w-64 flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหาเลขเอกสาร / สินค้า / คู่ค้า / สาขา" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">Ref</th><th className="p-2 text-left">Movement</th><th className="p-2 text-left">สินค้า</th><th className="p-2 text-left">คู่ค้า</th><th className="p-2 text-left">สาขา / คลัง</th><th className="p-2 text-right">เข้า</th><th className="p-2 text-right">ออก</th><th className="p-2 text-right">ราคา</th><th className="p-2 text-right">คงเหลือสินค้า</th></tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={10}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && rows.map((row) => (
              <tr key={row.id} className="border-t hover:bg-slate-50">
                <td className="p-2">{row.date}</td><td className="p-2 font-mono text-xs">{row.refType}:{row.refNo || '-'}</td><td className="p-2">{row.movementType}</td><td className="p-2">{row.productCode ? `${row.productCode} · ` : ''}{row.productName}</td><td className="p-2">{row.counterpartyName}</td><td className="p-2">{row.branchName} / {row.warehouseName}</td><td className="p-2 text-right text-emerald-700">{formatMoney(row.qtyIn)}</td><td className="p-2 text-right text-red-700">{formatMoney(row.qtyOut)}</td><td className="p-2 text-right">{formatMoney(row.unitCost)}</td><td className="p-2 text-right font-semibold">{formatMoney(row.runningBalanceByProduct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white p-3 shadow"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-lg font-bold text-slate-900">{value}</div></div>
}
