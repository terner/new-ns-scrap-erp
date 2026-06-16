'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DatePickerInput } from '@/components/ui/date-picker-input'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type AnyRow = Record<string, number | string | boolean | null | undefined>
type CashOthersPayload = {
  asOf: string
  charts: { arAging: Record<string, number>; assetComp: Array<{ color: string; name: string; val: number }>; debtComp: Array<{ color: string; name: string; val: number }> }
  pendingIssueSummary: Record<string, number>
  rows: { cashAccounts: AnyRow[]; debt: Record<string, number>; receivable: Record<string, number>; stock: Record<string, number> }
  sourceState: { limitations: string[] }
  summary: Record<string, number>
  tradingPending: Record<string, number>
}
function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function money(value: unknown) {
  return formatMoney(typeof value === 'number' ? value : Number(value ?? 0))
}

function text(value: unknown) {
  return String(value ?? '')
}

function num(value: unknown) {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

export function CashOthersSummaryPageClient() {
  const [asOf, setAsOf] = useState(today())
  const [data, setData] = useState<CashOthersPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const latestLoadRequestRef = useRef(0)
  useEffect(() => {
    const requestId = latestLoadRequestRef.current + 1
    latestLoadRequestRef.current = requestId
    setError(null)
    dailyFetchJson<CashOthersPayload>(`/api/cash-others-summary?asOf=${asOf}`)
      .then((payload) => {
        if (requestId !== latestLoadRequestRef.current) return
        setData(payload)
      })
      .catch((caught) => {
        if (requestId !== latestLoadRequestRef.current) return
        setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลไม่ได้')
      })
  }, [asOf])
  const summary = data?.summary ?? {}

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-white p-3 shadow"><label className="text-xs font-bold text-slate-500">As of</label><DatePickerInput className="w-[140px]" value={asOf} onChange={setAsOf} /><span className="flex-1" /><button className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500" disabled type="button">ส่งออก (ปิดการใช้งาน)</button></div>
      <div className="grid grid-cols-1 gap-4 rounded-md bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-center text-white shadow-lg md:grid-cols-4">
        <Grand label="Total Asset" value={summary.totalAsset} />
        <Grand label="Total Debt" value={summary.totalDebt} />
        <Grand label="Net Worth" value={summary.netWorth} />
        <Grand danger={(summary.cashNeededToday ?? 0) > (summary.totalCash ?? 0)} label="เงินที่ต้องใช้วันนี้" value={summary.cashNeededToday} />
      </div>
      {num(data?.pendingIssueSummary.count) > 0 ? <PendingSaleBlock summary={data?.pendingIssueSummary ?? {}} /> : null}
      <TradingPendingBlock summary={data?.tradingPending ?? {}} />
      <div className="grid gap-4 lg:grid-cols-3">
        <DonutPanel items={data?.charts.assetComp ?? []} title="🥧 องค์ประกอบสินทรัพย์" total={summary.totalAsset ?? 0} tone="emerald" />
        <DonutPanel empty="✅ ไม่มีหนี้" items={data?.charts.debtComp ?? []} title="🥧 องค์ประกอบหนี้สิน" total={summary.totalDebt ?? 0} tone="red" />
        <ArAging aging={data?.charts.arAging ?? {}} total={data?.rows.receivable.totalAR ?? 0} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <CashTable rows={data?.rows.cashAccounts ?? []} total={summary.totalCash ?? 0} />
        <ReceivableTable row={data?.rows.receivable ?? {}} />
        <StockTable row={data?.rows.stock ?? {}} />
        <DebtTable row={data?.rows.debt ?? {}} />
      </div>
      <Notice text={data?.sourceState.limitations[0]} />{error ? <ErrorBox text={error} /> : null}
    </section>
  )
}

function Grand({ danger = false, label, value }: { danger?: boolean; label: string; value: unknown }) {
  return <div><div className="text-sm opacity-80">{label}</div><div className={`break-words text-3xl font-bold ${danger ? 'text-red-200' : ''}`}>{money(value)}</div></div>
}

function PendingSaleBlock({ summary }: { summary: Record<string, number> }) {
  return <div className="rounded-md border-l-4 border-amber-500 bg-gradient-to-r from-amber-50 to-orange-50 p-4 shadow"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-bold text-amber-700"><span className="text-2xl">📦</span> ต้นทุนรอเปิดบิล (Pending Sale) — เงินค้างใน Stock ที่เบิกออกไปแล้ว</h3><Link className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-bold text-white" href="/sales/stock-issue">→ ดูทั้งหมด</Link></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Mini label="⏰ จำนวนใบ" tone="amber" value={money(summary.count)} /><Mini label="⚖ น้ำหนัก" tone="blue" value={`${money(summary.qty)} กก.`} /><Mini label="💰 ต้นทุน (เงินที่ค้าง)" tone="red" value={money(summary.cost)} /><Mini label="📈 ยอดขายคาด" tone="emerald" value={money(summary.est)} /></div></div>
}

function TradingPendingBlock({ summary }: { summary: Record<string, number> }) {
  return <div className="rounded-md border-l-4 border-purple-500 bg-gradient-to-r from-purple-50 to-pink-50 p-4 shadow"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-bold text-purple-700"><span className="text-2xl">🔄</span> Trading Pending รับเงิน — Trading ซื้อจ่ายแล้ว แต่ Sales ยังไม่เปิด</h3><Link className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-bold text-white" href="/trading/matching">→ Trading Matching</Link></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Mini label="📋 บิลซื้อ" tone="purple" value={`${money(summary.billCount)} ใบ`} /><Mini label="💸 จ่ายไปแล้ว" tone="blue" value={money(summary.paidAmount)} /><Mini label="✓ Match แล้ว" tone="emerald" value={money(summary.matchedAmount)} /><Mini label="⏳ Pending รับเงิน" tone="purpleStrong" value={money(summary.pendingAmount)} /></div></div>
}

function Mini({ label, tone, value }: { label: string; tone: string; value: string }) {
  const map: Record<string, string> = { amber: 'border-amber-200 text-amber-700', blue: 'border-blue-200 text-blue-700', emerald: 'border-emerald-200 text-emerald-700', purple: 'border-purple-200 text-purple-700', purpleStrong: 'border-purple-400 text-purple-700 border-2', red: 'border-red-300 text-red-700 border-2' }
  return <div className={`rounded-md border bg-white p-3 ${map[tone] ?? map.blue}`}><div className="text-xs">{label}</div><div className="break-words text-2xl font-bold">{value}</div></div>
}

function DonutPanel({ empty, items, title, total, tone }: { empty?: string; items: Array<{ color: string; name: string; val: number }>; title: string; total: number; tone: string }) {
  const gradient = conic(items, total)
  return <div className="rounded-md bg-white p-5 shadow-lg"><h3 className={`mb-3 font-bold ${tone === 'red' ? 'text-red-700' : 'text-emerald-700'}`}>{title}</h3><div className="mx-auto flex h-40 w-40 items-center justify-center rounded-md-full p-9" style={{ background: gradient }}><div className="flex h-full w-full items-center justify-center rounded-md-full bg-white text-center text-xs font-bold text-slate-700">รวม<br />{money(total)}</div></div><div className="mt-3 space-y-1 text-xs">{items.map((item) => <div key={item.name} className="flex justify-between gap-2"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-md" style={{ background: item.color }} />{item.name}</span><span className={`font-mono font-bold ${tone === 'red' ? 'text-red-600' : ''}`}>{money(item.val)}</span></div>)}{items.length === 0 ? <div className="py-3 text-center font-semibold text-emerald-700">{empty ?? 'ไม่มีข้อมูล'}</div> : null}</div></div>
}

function conic(items: Array<{ color: string; val: number }>, total: number) {
  if (!items.length || total <= 0) return 'conic-gradient(#e5e7eb 0% 100%)'
  let start = 0
  return `conic-gradient(${items.map((item) => {
    const end = start + item.val / total * 100
    const value = `${item.color} ${start}% ${end}%`
    start = end
    return value
  }).join(', ')})`
}

function ArAging({ aging, total }: { aging: Record<string, number>; total: number }) {
  const max = Math.max(1, ...Object.values(aging))
  return <div className="rounded-md bg-white p-5 shadow-lg"><h3 className="mb-3 font-bold text-cyan-700">📥 AR Aging — อายุลูกหนี้</h3><div className="space-y-2">{Object.entries(aging).map(([key, amount]) => <div key={key}><div className="mb-1 flex justify-between text-xs"><span className="font-medium">{agingLabel(key)}</span><span className="font-mono font-bold">{money(amount)}</span></div><div className="h-3 rounded-md-full bg-slate-100"><div className="h-3 rounded-md-full bg-cyan-500" style={{ width: `${Math.min(100, amount / max * 100)}%` }} /></div></div>)}</div><div className="mt-3 flex justify-between border-t pt-2 text-sm font-bold"><span>รวม AR</span><span className="text-cyan-700">{money(total)}</span></div></div>
}

function agingLabel(key: string) {
  return key === 'current' ? '✅ ยังไม่ครบกำหนด' : key === '90+' ? '> 90 วัน ⚠️' : `${key} วัน`
}

function CashTable({ rows, total }: { rows: AnyRow[]; total: number }) {
  return <Panel heading="💵 CASH & OTHERS" tone="emerald" total={total}><Table headers={['บัญชี', 'ประเภท', 'สกุล', 'Balance', 'THB Equiv']} rows={rows.map((row) => [text(row.name), text(row.type), text(row.currency), money(row.balance), money(row.thbEquivalent)])} /></Panel>
}

function ReceivableTable({ row }: { row: Record<string, number> }) {
  return <Panel heading="📈 RECEIVABLE / ลูกหนี้" tone="blue" total={row.totalAR}><KeyRows rows={[['ลูกหนี้ในประเทศ', row.arDomestic], ['ลูกหนี้ต่างประเทศ', row.arOverseas], ['ลูกหนี้เกินกำหนด', row.arOverdue, 'amber'], ['+ Customer Advance ที่รับไว้', row.customerAdvanceTotal, 'emerald']]} /></Panel>
}

function StockTable({ row }: { row: Record<string, number> }) {
  return <Panel heading="📦 STOCK" tone="amber" total={row.val}><KeyRows rows={[['น้ำหนัก Stock รวม', `${money(row.qty)} กก.`], ['มูลค่า Stock รวม (WAC)', row.val], ['Stock ที่จ่ายเงินแล้ว (ประมาณ)', row.paidVal, 'emerald'], ['Stock ที่ยังค้างจ่าย', row.unpaidVal, 'amber']]} /></Panel>
}

function DebtTable({ row }: { row: Record<string, number> }) {
  return <Panel heading="📉 DEBT / ภาระหนี้" tone="red" total={row.totalAP + row.customerAdvanceTotal}><KeyRows rows={[['เจ้าหนี้การค้า (AP)', row.totalAP], ['เจ้าหนี้เกินกำหนด', row.apOverdue, 'red'], ['Customer Advance (Liability)', row.customerAdvanceTotal], ['ค่าใช้จ่ายวันนี้', row.expenseToday, 'amber'], ['Supplier Advance ที่จ่ายไว้ (Asset)', row.supplierAdvanceTotal, 'emerald']]} /></Panel>
}

function Panel({ children, heading, tone, total }: { children: ReactNode; heading: string; tone: string; total: unknown }) {
  const map: Record<string, string> = { amber: 'bg-amber-50 text-amber-700', blue: 'bg-blue-50 text-blue-700', emerald: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700' }
  return <div className="overflow-hidden rounded-md bg-white shadow"><div className={`flex justify-between border-b px-4 py-3 font-semibold ${map[tone]}`}><span>{heading}</span><span>{money(total as number)}</span></div>{children}</div>
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-xs"><thead className="bg-slate-50"><tr>{headers.map((header) => <th key={header} className="p-2 text-left last:text-right">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`} className="border-t">{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className={`p-2 ${cellIndex >= row.length - 2 ? 'text-right' : ''}`}>{cell}</td>)}</tr>)}</tbody></table></div>
}

function KeyRows({ rows }: { rows: Array<[string, number | string | undefined, string?]> }) {
  const bg: Record<string, string> = { amber: 'bg-amber-50 text-amber-700', emerald: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700' }
  return <table className="w-full text-xs"><tbody>{rows.map(([label, value, tone]) => <tr key={label} className={`border-t ${tone ? bg[tone] : ''}`}><td className="p-2">{label}</td><td className="p-2 text-right font-medium">{typeof value === 'string' ? value : money(value)}</td></tr>)}</tbody></table>
}

function Notice({ text }: { text?: string }) {
  return <div className="rounded-md border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900"><b>Read-only baseline</b><span className="ml-2">{text ?? 'ไม่มี write action ใน baseline นี้'}</span></div>
}

function ErrorBox({ text }: { text: string }) {
  return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{text}</div>
}
