'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'
import type { StockOption } from '@/lib/stock'

type BalanceRow = {
  avgCost: number
  branchId: string
  branchName: string
  key: string
  lastDate: string
  lotNo: string
  notAvailable: boolean
  productCode: string
  productId: string
  productName: string
  qty: number
  status: string
  value: number
  warehouseId: string
  warehouseName: string
}

type BalancePayload = {
  byStatus: Array<{ count: number; qty: number; status: string; value: number }>
  reference: { branches: StockOption[]; products: StockOption[]; warehouses: StockOption[] }
  rows: BalanceRow[]
  summary: { availableQty: number; availableValue: number; count: number; negativeRows: number; notAvailableQty: number; notAvailableValue: number; qty: number; value: number }
}

export function StockBalancePageClient() {
  const [branchId, setBranchId] = useState('')
  const [data, setData] = useState<BalancePayload | null>(null)
  const [detailRow, setDetailRow] = useState<BalanceRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [warehouseId, setWarehouseId] = useState('')

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (branchId) params.set('branchId', branchId)
      if (warehouseId) params.set('warehouseId', warehouseId)
      if (status) params.set('status', status)
      setData(await dailyFetchJson<BalancePayload>(`/api/stock/balance?${params.toString()}`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดสต๊อกคงเหลือไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [branchId, q, status, warehouseId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const matrixRows = useMemo(() => {
    const groups = new Map<string, { fgQty: number; fgVal: number; group: string; rmQty: number; rmVal: number; wipQty: number; wipVal: number }>()
    for (const row of data?.rows ?? []) {
      const key = row.productCode || row.productName
      const current = groups.get(key) ?? { fgQty: 0, fgVal: 0, group: `${row.productCode} ${row.productName}`.trim(), rmQty: 0, rmVal: 0, wipQty: 0, wipVal: 0 }
      if (row.status === 'FG') {
        current.fgQty += row.qty
        current.fgVal += row.value
      } else if (row.status === 'WIP') {
        current.wipQty += row.qty
        current.wipVal += row.value
      } else {
        current.rmQty += row.qty
        current.rmVal += row.value
      }
      groups.set(key, current)
    }
    return Array.from(groups.values()).sort((a, b) => (b.rmVal + b.wipVal + b.fgVal) - (a.rmVal + a.wipVal + a.fgVal))
  }, [data?.rows])

  function exportXlsx() {
    const params = new URLSearchParams({ format: 'xlsx' })
    if (q.trim()) params.set('q', q.trim())
    if (branchId) params.set('branchId', branchId)
    if (warehouseId) params.set('warehouseId', warehouseId)
    if (status) params.set('status', status)
    window.location.href = `/api/stock/balance?${params.toString()}`
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-blue-700 to-cyan-700 p-5 text-white shadow">
        <h1 className="text-2xl font-bold">สต๊อกคงเหลือ / Stock Balance</h1>
        <p className="mt-1 text-sm opacity-90">ยอดคงเหลือจาก Stock Ledger แยกสินค้า สาขา คลัง Lot และสถานะ RM/WIP/FG</p>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="น้ำหนักรวม" value={`${formatMoney(data?.summary.qty ?? 0)} กก.`} tone="blue" />
        <Metric label="มูลค่ารวม" value={formatMoney(data?.summary.value ?? 0)} tone="emerald" />
        <Metric label="พร้อมขาย" value={`${formatMoney(data?.summary.availableQty ?? 0)} กก.`} />
        <Metric label="ไม่พร้อมขาย" value={`${formatMoney(data?.summary.notAvailableQty ?? 0)} กก.`} tone="amber" />
        <Metric label="แถวติดลบ" value={`${data?.summary.negativeRows ?? 0}`} tone="red" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {(data?.byStatus ?? []).map((item) => <Metric key={item.status} label={`${item.status} (${item.count} รายการ)`} value={`${formatMoney(item.qty)} กก. · ${formatMoney(item.value)}`} />)}
      </div>
      <div className="rounded-lg bg-white p-3 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <input className="min-w-56 flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหารหัส/ชื่อสินค้า/Lot/สาขา/คลัง" type="search" value={q} onChange={(event) => setQ(event.target.value)} />
          <select className="rounded-lg border px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">ทุกสถานะ</option><option value="RM">RM</option><option value="WIP">WIP</option><option value="FG">FG</option>
          </select>
          <select className="rounded-lg border px-3 py-2 text-sm" value={branchId} onChange={(event) => { setBranchId(event.target.value); setWarehouseId('') }}>
            <option value="">ทุกสาขา</option>{data?.reference.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select className="rounded-lg border px-3 py-2 text-sm" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
            <option value="">ทุกคลัง</option>{data?.reference.warehouses.filter((item) => !branchId || item.branchId === branchId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button className="rounded bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700" type="button" onClick={() => void loadData()}>Refresh</button>
          <button className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white" type="button" onClick={exportXlsx}>Export .xlsx</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-slate-100"><tr><th className="p-2 text-left">สินค้า</th><th className="p-2 text-left">สถานะ</th><th className="p-2 text-left">สาขา / คลัง</th><th className="p-2 text-left">Lot</th><th className="p-2 text-right">คงเหลือ</th><th className="p-2 text-right">มูลค่า</th><th className="p-2 text-right">Avg Cost</th><th className="p-2 text-center">พร้อมขาย</th><th className="p-2 text-center">Action</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={9}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && (data?.rows ?? []).map((row) => (
              <tr key={row.key} className={row.qty < 0 ? 'border-t bg-red-50/60' : 'border-t hover:bg-slate-50'}>
                <td className="p-2"><b>{row.productCode}</b><div className="text-xs text-slate-500">{row.productName}</div></td>
                <td className="p-2">{row.status || '-'}</td>
                <td className="p-2">{row.branchName}<div className="text-xs text-slate-500">{row.warehouseName}</div></td>
                <td className="p-2 font-mono text-xs">{row.lotNo || '-'}</td>
                <td className="p-2 text-right font-bold">{formatMoney(row.qty)}</td>
                <td className="p-2 text-right">{formatMoney(row.value)}</td>
                <td className="p-2 text-right">{formatMoney(row.avgCost)}</td>
                <td className="p-2 text-center">{row.notAvailable ? 'No' : 'Yes'}</td>
                <td className="p-2 text-center"><button className="rounded bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700" type="button" onClick={() => setDetailRow(row)}>Detail</button></td>
              </tr>
            ))}
            {!isLoading && !data?.rows.length ? <tr><td className="p-8 text-center text-slate-400" colSpan={9}>ไม่มีสต๊อกตามเงื่อนไข</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100"><tr><th className="p-2 text-left">สินค้า</th><th className="p-2 text-right">RM</th><th className="p-2 text-right">WIP</th><th className="p-2 text-right">FG</th><th className="p-2 text-right">รวม</th></tr></thead>
          <tbody>{matrixRows.slice(0, 20).map((row) => <tr key={row.group} className="border-t"><td className="p-2">{row.group}</td><td className="p-2 text-right">{formatMoney(row.rmQty)}</td><td className="p-2 text-right">{formatMoney(row.wipQty)}</td><td className="p-2 text-right">{formatMoney(row.fgQty)}</td><td className="p-2 text-right font-bold">{formatMoney(row.rmQty + row.wipQty + row.fgQty)}</td></tr>)}</tbody>
        </table>
      </div>
      {detailRow ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-10">
          <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4"><h3 className="font-bold">รายละเอียดสต๊อก</h3><button className="text-2xl text-slate-400" type="button" onClick={() => setDetailRow(null)}>&times;</button></div>
            <div className="space-y-2 p-5 text-sm">
              <Info label="สินค้า" value={`${detailRow.productCode} ${detailRow.productName}`} />
              <Info label="สถานะ" value={detailRow.status || '-'} />
              <Info label="สาขา/คลัง" value={`${detailRow.branchName} / ${detailRow.warehouseName}`} />
              <Info label="Lot" value={detailRow.lotNo || '-'} />
              <Info label="คงเหลือ" value={`${formatMoney(detailRow.qty)} กก.`} />
              <Info label="มูลค่า" value={formatMoney(detailRow.value)} />
              <Info label="ต้นทุนเฉลี่ย" value={formatMoney(detailRow.avgCost)} />
              <Info label="วันที่ล่าสุด" value={detailRow.lastDate} />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex border-b py-1"><span className="w-32 text-slate-500">{label}</span><span className="font-medium text-slate-900">{value}</span></div>
}

function Metric({ label, tone, value }: { label: string; tone?: 'amber' | 'blue' | 'emerald' | 'red'; value: string }) {
  const color = tone === 'blue' ? 'text-blue-700' : tone === 'emerald' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-700' : tone === 'red' ? 'text-red-700' : 'text-slate-900'
  return <div className="rounded-lg bg-white p-3 shadow"><div className="text-xs text-slate-500">{label}</div><div className={`mt-1 text-lg font-bold ${color}`}>{value}</div></div>
}
