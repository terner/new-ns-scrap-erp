'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type AnyRow = Record<string, number | string | boolean | null | undefined>
type LmeConfig = { fxRate: number; kgPerContainer: number; lmeAluminumUSD: number; lmeBrassUSD: number; lmeCopperUSD: number; updatedAt: string; updatedBy: string }
type PendingPayload = {
  customers: { id: string; name: string }[]
  lmeConfig: LmeConfig
  metalGroups: string[]
  productDetails: AnyRow[]
  productRows: AnyRow[]
  reconciliation: AnyRow[]
  reconTotals: Record<string, number>
  sourceState: { limitations: string[] }
  summary: Record<string, number>
}
type SalesPlanPayload = {
  filters: { channels: { id: string; name: string }[]; metalGroups: string[]; month: string }
  lmeConfig: LmeConfig
  planRows: AnyRow[]
  productAnalysis: AnyRow[]
  sourceState: { limitations: string[] }
  summary: Record<string, number>
}
type CommissionPayload = {
  billRows: AnyRow[]
  filters: { dateFrom: string; dateTo: string; periods: string[] }
  salesRows: AnyRow[]
  sourceState: { limitations: string[] }
  suppliers: AnyRow[]
  totals: Record<string, number>
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

export function PendingSalesPageClient() {
  const [data, setData] = useState<PendingPayload | null>(null)
  const [mode, setMode] = useState<'all' | 'pending' | 'sold'>('pending')
  const [customerId, setCustomerId] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dailyFetchJson<PendingPayload>('/api/pending-sales').then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลไม่ได้'))
  }, [])

  const productRows = useMemo(() => (data?.productRows ?? [])
    .filter((row) => selectedGroups.length === 0 || selectedGroups.includes(text(row.metalGroup)))
    .filter((row) => mode === 'all' || (mode === 'pending' ? num(row.remainQty) > 0 : num(row.soldQty) > 0)), [data, mode, selectedGroups])
  const details = (data?.productDetails ?? []).filter((row) => text(row.productId) === selectedProductId).filter((row) => !customerId || text(row.customerId) === customerId)
  const selectedProduct = productRows.find((row) => text(row.productId) === selectedProductId)

  return (
    <section className="space-y-3">
      <Hero tone="from-amber-600 to-orange-600" title="⏰ รายการรอขาย / Pending Sales — เทียบกับ LME" subtitle="สรุปสินค้าที่รอขาย · เปรียบเทียบกับราคา LME · กำไร/ขาดทุน · Cost Pool vs Stock" />
      <LmeCard config={data?.lmeConfig} products={productRows} />
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow">
        <Segment active={mode === 'pending'} color="amber" onClick={() => setMode('pending')}>⏳ ยังรอขาย</Segment>
        <Segment active={mode === 'sold'} color="emerald" onClick={() => setMode('sold')}>✅ ขายแล้ว</Segment>
        <Segment active={mode === 'all'} color="blue" onClick={() => setMode('all')}>📋 ทั้งหมด</Segment>
        <select className="control" value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">ทุก Customer</option>{(data?.customers ?? []).map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select>
        <span className="flex-1" /><button className="btn-disabled" disabled type="button">📥 Export CSV</button>
      </div>
      <MetalChips groups={data?.metalGroups ?? []} selected={selectedGroups} setSelected={setSelectedGroups} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="รายการสินค้า" value={money(productRows.length)} tone="blue" />
        <Metric label="น้ำหนักรวม" value={`${money(data?.summary.totalRemainQty)} กก.`} tone="amber" />
        <Metric label="มูลค่ารวม" value={money(data?.summary.totalRemainValue)} tone="amber" />
        <Metric label="ราคาเฉลี่ย" value={`${money(data?.summary.avgRemainPrice)}/กก.`} tone="slate" />
        <Metric label="กำไรรวม vs LME" value={money(data?.summary.totalGainVsLme)} tone={(data?.summary.totalGainVsLme ?? 0) >= 0 ? 'emerald' : 'red'} />
      </div>
      {!selectedProductId ? <PendingSummary rows={productRows} mode={mode} onSelect={setSelectedProductId} /> : <PendingDetails details={details} name={text(selectedProduct?.productName)} onBack={() => setSelectedProductId('')} />}
      <PoolStock data={data} />
      <Notice text={data?.sourceState.limitations[0]} />
      {error ? <ErrorBox text={error} /> : null}
    </section>
  )
}

export function SalesPlanPageClient() {
  const [data, setData] = useState<SalesPlanPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    dailyFetchJson<SalesPlanPayload>('/api/sales-plan').then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลไม่ได้'))
  }, [])
  const s = data?.summary ?? {}
  return (
    <section className="space-y-3">
      <Hero action={<button className="rounded-lg bg-white px-4 py-2 font-bold text-amber-700 opacity-70" disabled type="button">+ เพิ่มรายการ</button>} tone="from-amber-700 to-orange-600" title="📋 วางแผนการขาย (Sales Plan) — ทองแดง / ทองเหลือง" subtitle="เสนอ % LME + ช่องทางขาย → Lock เพื่อยืนยันราคา → ตู้ในรอขายลดลงหลังออกแบบ write flow" />
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm md:grid-cols-5">
        <LmeStat label="🥉 ทองแดง LME" value={`${money(data?.lmeConfig.lmeCopperUSD)} USD/MT`} />
        <LmeStat label="🌟 ทองเหลือง LME" value={`${money(data?.lmeConfig.lmeBrassUSD)} USD/MT`} />
        <LmeStat label="💱 USD/THB" value={money(data?.lmeConfig.fxRate)} />
        <LmeStat label="📦 กก./ตู้" value={`${money(data?.lmeConfig.kgPerContainer)} กก.`} />
        <div className="text-xs text-slate-500">แก้ที่หน้า รายการรอขาย — Tab LME Config</div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow"><label className="text-sm">เดือน</label><input className="control" type="month" value={data?.filters.month ?? ''} readOnly /><select className="control"><option>ทุกหมวด (ทองแดง+ทองเหลือง)</option></select><select className="control"><option>ทุกช่องทาง</option></select><span className="flex-1" /><button className="btn-disabled" disabled type="button">📥 Export CSV</button></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metric label="รายการแผน" value={money(s.plansCount)} tone="slate" />
        <Metric label="จำนวนตู้รวม" value={money(s.totalContainers)} tone="blue" />
        <Metric label="น้ำหนักรวม" value={`${money(s.totalKg)} กก.`} tone="blue" />
        <Metric label="กำไรล็อกแล้ว" value={money(s.totalLockedProfit)} tone="emerald" />
        <Metric label="กำไรคาดการณ์" value={money(s.totalProjectedProfit)} tone={(s.totalProjectedProfit ?? 0) >= 0 ? 'amber' : 'red'} />
      </div>
      <Panel title="📝 ตารางวางแผน — ปลดล็อก = อยู่ในขั้นเสนอ / ล็อก = ราคายืนยันแล้ว ตู้จะถูกหักจากรอขาย">
        <SimpleTable headers={['สินค้า', 'ช่องทาง', 'ลูกค้า', 'ตู้', 'กก./ตู้', 'รวม กก.', '% LME', 'LME', 'FX', 'ราคา THB/kg', 'สถานะ', '']} rows={[]} empty="ยังไม่มี sales plan persistence ใน baseline นี้" />
      </Panel>
      <Panel title="📊 วิเคราะห์ขาย vs รายการรอขาย — ผู้บริหารตัดสินใจ">
        <SimpleTable headers={['สินค้า', 'หมวด', 'Stock รวม', 'ล็อกแล้ว', 'ว่างให้ขาย', 'WAC', 'ราคาเสนอดีสุด', '% LME', 'กำไรคาดการณ์', 'Margin %', 'คำแนะนำ']} rows={(data?.productAnalysis ?? []).map((row) => [text(row.name), text(row.metalGroup), money(row.stock), money(row.lockedKg), money(row.remainingKg), money(row.wac), money(row.bestPlanPrice), `${money(row.bestPlanPct)}%`, money(row.projectedProfit), `${money(row.projectedMarginPct)}%`, text(row.recommendation)])} />
      </Panel>
      <Panel title={`📦 ตู้รอขาย คงเหลือหลังหักล็อกราคา — เดือน ${data?.filters.month ?? ''}`}>
        <div className="mb-3 flex flex-wrap gap-2 text-xs"><span className="chip">รวม {money(s.stockRemainingKg)} กก.</span><span className="chip">มูลค่า WAC {money(s.stockRemainingValue)}</span></div>
        <SimpleTable headers={['รหัส', 'สินค้า', 'หมวด', 'Stock ทั้งหมด', 'ล็อกแล้ว kg', 'ล็อกแล้ว ตู้', 'รอล็อก kg', 'รอล็อก ตู้', 'WAC', 'มูลค่า WAC']} rows={(data?.productAnalysis ?? []).map((row) => [text(row.code), text(row.name), text(row.metalGroup), money(row.stock), money(row.lockedKg), money(0), money(row.remainingKg), money(row.remainingContainers), money(row.wac), money(row.value)])} />
      </Panel>
      <Notice text={data?.sourceState.limitations[0]} />{error ? <ErrorBox text={error} /> : null}
    </section>
  )
}

export function SalesCommissionPageClient() {
  const [data, setData] = useState<CommissionPayload | null>(null)
  const [selectedSales, setSelectedSales] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    dailyFetchJson<CommissionPayload>('/api/sales-commission').then(setData).catch((caught) => setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลไม่ได้'))
  }, [])
  const sales = (data?.salesRows ?? []).find((row) => text(row.id) === selectedSales)
  const billRows = (data?.billRows ?? []).filter((row) => text(row.salesId) === selectedSales)
  if (selectedSales && sales) {
    return <section className="space-y-4"><Hero action={<button className="rounded bg-white/20 px-3 py-2 text-sm" type="button" onClick={() => setSelectedSales('')}>← กลับ</button>} tone="from-blue-700 to-indigo-700" title={text(sales.name)} subtitle={`${text(sales.code)} · ${text(sales.phone) || '-'}`} /><div className="grid grid-cols-3 gap-3"><Metric label="จำนวนบิลรับซื้อ" value={money(billRows.length)} tone="blue" /><Metric label="น้ำหนักรวม" value={`${money(sales.qty)} กก.`} tone="amber" /><Metric label="ยอดรับซื้อรวม" value={money(sales.purchaseAmt)} tone="blue" /></div><Panel title="🏭 Supplier ในความดูแล"><SimpleTable headers={['Supplier', 'บิล', 'น้ำหนัก', 'ยอดรับซื้อ', 'ราคาเฉลี่ย/กก.', '% ของ Total']} rows={billRows.map((row) => [text(row.supplierName), '1', money(row.qty), money(row.amount), money(row.price), `${money(num(row.amount) / Math.max(1, num(sales.purchaseAmt)) * 100)}%`])} /></Panel><Panel title="📊 รายการสินค้าละเอียด"><SimpleTable headers={['วันที่', 'เลขที่บิล', 'Supplier', 'สินค้า', 'น้ำหนัก', 'ราคาซื้อ', 'ราคาหน้าใบ', 'ยอดรวม']} rows={billRows.map((row) => [text(row.date), text(row.docNo), text(row.supplierName), text(row.productName), money(row.qty), money(row.price), money(row.facePrice), money(row.amount)])} /></Panel></section>
  }
  return (
    <section className="space-y-4">
      <Hero tone="from-blue-700 to-indigo-700" title="💼 Sales Tracking — ผลงานพนักงาน" subtitle="ผูก Sales กับ Supplier · ดึงยอดบิลรับซื้อ · กดการ์ดเพื่อดูรายละเอียด" />
      <div className="rounded-2xl bg-white p-4 shadow"><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-slate-500">📅 ช่วงเวลา:</span>{['วันนี้', '7 วัน', 'เดือนนี้', 'ไตรมาส', 'ปีนี้'].map((p) => <button key={p} className="rounded bg-slate-100 px-3 py-1.5 text-xs font-bold" disabled type="button">{p}</button>)}<input className="control" type="date" value={data?.filters.dateFrom ?? ''} readOnly /><span>→</span><input className="control" type="date" value={data?.filters.dateTo ?? ''} readOnly /><button className="btn-disabled ml-auto" disabled type="button">📥 Export CSV</button></div><div className="mt-2 text-xs"><span className="chip">📋 บิลซื้อ <b>{money(data?.totals.bills)}</b></span></div></div>
      <div className="grid gap-4 md:grid-cols-2"><BigCard label="📦 น้ำหนักรับซื้อรวม" tone="from-amber-500 to-orange-600" value={`${money(data?.totals.qty)} กก.`} /><BigCard label="💰 ยอดรับซื้อรวม" tone="from-blue-600 to-indigo-700" value={money(data?.totals.purchaseAmt)} /></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{(data?.salesRows ?? []).map((row) => <button key={text(row.id)} className="rounded-2xl border-l-4 border-blue-500 bg-white p-5 text-left shadow-lg hover:bg-blue-50" type="button" onClick={() => setSelectedSales(text(row.id))}><div className="font-bold">{text(row.name)}</div><div className="text-xs text-slate-500">{text(row.code)} · {text(row.phone)}</div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><Mini label="บิล" value={money(row.billCount)} /><Mini label="Supplier" value={money(row.supplierCount)} /></div><Metric label="น้ำหนักรับซื้อ" value={`${money(row.qty)} กก.`} tone="amber" /><Metric label="ยอดรับซื้อรวม" value={money(row.purchaseAmt)} tone="blue" /><Metric label="ค่าคอมเดือนนี้" value={money(row.commission)} tone={row.eligible ? 'emerald' : 'slate'} /></button>)}</div>
      <Panel title={`🏭 ผูก Supplier กับพนักงานขาย (${data?.suppliers.length ?? 0} ราย)`}><div className="mb-3 flex gap-2"><input className="control" placeholder="ค้นหา Supplier" readOnly /><select className="control"><option>ทุก Sales</option></select></div><SimpleTable headers={['รหัส', 'ชื่อ Supplier', 'โทร', 'พนักงานขายที่รับผิดชอบ']} rows={(data?.suppliers ?? []).slice(0, 200).map((row) => [text(row.code), text(row.name), text(row.phone), text((data?.salesRows ?? []).find((sale) => text(sale.id) === text(row.salesId))?.name ?? '(ไม่ได้กำหนด)')])} /></Panel>
      <Notice text={data?.sourceState.limitations[0]} />{error ? <ErrorBox text={error} /> : null}
    </section>
  )
}

function Hero({ action, subtitle, title, tone }: { action?: ReactNode; subtitle: string; title: string; tone: string }) {
  return <div className={`rounded-xl bg-gradient-to-r ${tone} p-4 text-white shadow`}><div className="flex items-start justify-between gap-3"><div><h1 className="text-xl font-bold">{title}</h1><p className="mt-1 text-sm opacity-80">{subtitle}</p></div>{action}</div></div>
}

function LmeCard({ config, products }: { config?: LmeConfig; products: AnyRow[] }) {
  return <><div className="rounded-xl bg-white p-4 shadow"><div className="mb-3 flex justify-between"><h3 className="font-bold text-slate-700">📊 LME Reference Pricing</h3><button className="btn-disabled" disabled type="button">💾 บันทึก</button></div><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><LmeStat label="🥉 ทองแดง LME (USD/MT)" value={money(config?.lmeCopperUSD)} /><LmeStat label="🌟 ทองเหลือง LME (USD/MT)" value={money(config?.lmeBrassUSD)} /><LmeStat label="⚪ อลูมิเนียม LME (USD/MT)" value={money(config?.lmeAluminumUSD)} /><LmeStat label="💱 เรท USD/THB" value={money(config?.fxRate)} /></div><div className="mt-2 text-xs text-slate-400">⏰ อัปเดตล่าสุด: {config?.updatedAt ?? '-'} โดย {config?.updatedBy ?? '-'}</div></div><details className="rounded-xl bg-white shadow"><summary className="cursor-pointer p-3 font-bold text-slate-700">📋 ตั้งค่าผู้ซื้อซื้อที่ LME กี่ % ต่อสินค้า — เฉพาะ 🥉 ทองแดง / 🌟 ทองเหลือง</summary><SimpleTable headers={['รหัส', 'สินค้า', 'หมวด', 'LME ฐาน', '% ที่ซื้อ', 'ราคาเป้า', 'WAC', 'Diff']} rows={products.filter((row) => text(row.metalGroup).includes('ทองแดง') || text(row.metalGroup).includes('ทองเหลือง')).map((row) => [text(row.productCode), text(row.productName), text(row.metalGroup), money(text(row.metalGroup).includes('ทองแดง') ? config?.lmeCopperUSD : config?.lmeBrassUSD), `${money(row.lmeBuyPercent)}%`, money(row.lmeTarget), money(row.wac), money(num(row.wac) - num(row.lmeTarget))])} /></details></>
}

function PendingSummary({ mode, onSelect, rows }: { mode: string; onSelect: (id: string) => void; rows: AnyRow[] }) {
  return <SimpleTable headers={['สินค้า', 'หมวด', 'PO', `${mode === 'sold' ? 'ขายแล้ว' : 'รอขาย'} (กก.)`, 'มูลค่า', 'ราคาเฉลี่ย', 'WAC', 'LME Target', 'vs WAC', 'vs LME', '']} rows={rows.map((row) => [text(row.productCode) + ' ' + text(row.productName), text(row.metalGroup), money(row.poCount), money(mode === 'sold' ? row.soldQty : row.remainQty), money(mode === 'sold' ? row.soldValue : row.remainValue), money(row.avgPriceRemain), money(row.wac), money(row.lmeTarget), `${money(row.diffPctWac)}%`, `${money(row.diffPctLme)}%`, '▼ ดูรายละเอียด'])} rowClick={(index) => onSelect(text(rows[index]?.productId))} />
}

function PendingDetails({ details, name, onBack }: { details: AnyRow[]; name: string; onBack: () => void }) {
  return <div className="space-y-3"><div className="flex justify-between rounded border-l-4 border-blue-500 bg-blue-50 p-3"><div><div className="text-xs text-slate-500">เลือกสินค้า</div><div className="font-bold text-blue-700">{name}</div></div><button className="text-sm text-slate-600" type="button" onClick={onBack}>← กลับสรุปทั้งหมด</button></div><SimpleTable headers={['เลขที่ PO', 'วันที่', 'Customer', 'จำนวน', 'ราคา', 'ขายแล้ว', 'รอขาย', 'มูลค่ารอ', 'วันส่ง']} rows={details.map((row) => [text(row.docNo), text(row.date), text(row.customerName), money(row.itemQty), money(row.itemPrice), money(row.matched), money(row.remaining), money(row.remainValue), text(row.deliveryDate)])} /></div>
}

function PoolStock({ data }: { data: PendingPayload | null }) {
  return <><Hero tone="from-indigo-600 to-purple-700" title="📦 Pool & Stock Inventory" subtitle="PO On-Order = จองซื้อ · Spot in Pool = บิลรับซื้อจริง − matched · Stock จริง = จาก Stock Ledger · Pool ≠ Stock" /><div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="PO On-Order" value={`${money(data?.reconTotals.totalPoOnOrderQty)} กก.`} tone="purple" /><Metric label="Spot in Pool" value={`${money(data?.reconTotals.totalSpotInPoolQty)} กก.`} tone="emerald" /><Metric label="Stock จริง" value={`${money(data?.reconTotals.totalStockQty)} กก.`} tone="blue" /><Metric label="จำนวนสินค้า" value={money(data?.reconTotals.productCount)} tone="slate" /></div><SimpleTable headers={['รหัส / สินค้า', 'หมวด · Status', 'PO On-Order', 'Spot in Pool', 'Stock จริง', 'WAC']} rows={(data?.reconciliation ?? []).map((row) => [`${text(row.productCode)} ${text(row.productName)}`, `${text(row.metalGroup)} · ${text(row.itemStatus)}`, money(row.poOnOrderQty), money(row.spotInPoolQty), money(row.stockQty), money(row.stockWAC)])} /></>
}

function SimpleTable({ empty = 'ไม่มีข้อมูล', headers, rowClick, rows }: { empty?: string; headers: string[]; rowClick?: (index: number) => void; rows: string[][] }) {
  return <div className="overflow-x-auto rounded-xl bg-white shadow"><table className="min-w-[760px] w-full text-xs"><thead className="bg-slate-100"><tr>{headers.map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`} className={`border-t hover:bg-amber-50/30 ${rowClick ? 'cursor-pointer' : ''}`} onClick={() => rowClick?.(index)}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className={`p-2 ${cellIndex > 1 ? 'text-right' : ''}`}>{cell}</td>)}</tr>)}{rows.length === 0 ? <tr><td className="py-8 text-center text-slate-400" colSpan={headers.length}>{empty}</td></tr> : null}</tbody></table></div>
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return <div className="overflow-hidden rounded-xl bg-white shadow"><div className="border-b bg-amber-50 p-2 text-xs font-bold text-amber-700">{title}</div><div className="p-3">{children}</div></div>
}

function Segment({ active, children, color, onClick }: { active: boolean; children: ReactNode; color: 'amber' | 'blue' | 'emerald'; onClick: () => void }) {
  const activeClass = color === 'amber' ? 'bg-amber-600 text-white' : color === 'emerald' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
  return <button className={`rounded-lg px-4 py-2 text-sm font-medium ${active ? activeClass : 'bg-white text-slate-600 shadow'}`} type="button" onClick={onClick}>{children}</button>
}

function MetalChips({ groups, selected, setSelected }: { groups: string[]; selected: string[]; setSelected: (groups: string[]) => void }) {
  return <div className="rounded-xl bg-white p-3 shadow"><div className="mb-2 flex justify-between gap-3"><h4 className="text-sm font-semibold text-slate-700">📂 หมวดสินค้า ({selected.length === 0 ? 'แสดงทุกหมวด' : `เลือก ${selected.length} หมวด`})</h4><div className="flex gap-2"><button className="chip" type="button" onClick={() => setSelected([])}>เลือกทั้งหมด</button><button className="chip" type="button" onClick={() => setSelected(['__NONE__'])}>ไม่เลือก</button></div></div><div className="flex flex-wrap gap-2">{groups.map((group) => <button key={group} className={`rounded-lg border-2 px-3 py-1.5 text-xs ${selected.includes(group) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white text-slate-600'}`} type="button" onClick={() => setSelected(selected.includes(group) ? selected.filter((item) => item !== group) : selected.filter((item) => item !== '__NONE__').concat(group))}>{group}</button>)}</div></div>
}

function LmeStat({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs text-blue-700">{label}</div><div className="font-bold">{value}</div></div>
}

function Metric({ label, tone, value }: { label: string; tone: string; value: string }) {
  const map: Record<string, string> = { amber: 'bg-amber-50 text-amber-700', blue: 'bg-blue-50 text-blue-700', emerald: 'bg-emerald-50 text-emerald-700', purple: 'bg-purple-50 text-purple-700', red: 'bg-red-50 text-red-700', slate: 'bg-slate-50 text-slate-700' }
  return <div className={`rounded-xl p-3 shadow ${map[tone] ?? map.slate}`}><div className="text-xs opacity-75">{label}</div><div className="text-xl font-bold">{value}</div></div>
}

function BigCard({ label, tone, value }: { label: string; tone: string; value: string }) {
  return <div className={`rounded-2xl bg-gradient-to-br ${tone} p-6 text-white shadow-xl`}><div className="text-sm opacity-80">{label}</div><div className="break-words font-mono text-3xl font-bold">{value}</div></div>
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded bg-slate-50 p-2 text-center"><div className="text-slate-500">{label}</div><div className="font-bold text-slate-700">{value}</div></div>
}

function Notice({ text: value }: { text?: string }) {
  return <div className="rounded border-l-4 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900"><b>Read/design baseline</b><span className="ml-2">{value ?? 'ไม่มี write action ใน baseline นี้'}</span></div>
}

function ErrorBox({ text: value }: { text: string }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{value}</div>
}
