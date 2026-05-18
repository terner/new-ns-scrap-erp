'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { dailyFetchJson, formatMoney, todayDateInput } from '@/lib/daily'
import type { CustomerReturnFormValues, StatusConvertFormValues, StockAdjustFormValues, StockConvertFormValues, StockOption } from '@/lib/stock'

type Mode = 'adjust' | 'convert' | 'customer-return' | 'status-convert'
type Payload = {
  reference: { branches: StockOption[]; customers?: StockOption[]; products: StockOption[]; warehouses: StockOption[] }
  rows: Array<Record<string, string | number | boolean | null>>
}

const config = {
  adjust: {
    accent: 'from-amber-600 to-orange-600',
    api: '/api/stock/adjust',
    title: 'Stock Count Adjustment / ปรับสต๊อกจากการนับจริง',
  },
  convert: {
    accent: 'from-cyan-700 to-teal-700',
    api: '/api/stock/convert',
    title: 'Grade Adjustment / ปรับเกรดสินค้า',
  },
  'customer-return': {
    accent: 'from-purple-700 to-pink-700',
    api: '/api/stock/customer-return',
    title: 'Customer Return Stock / สต๊อกของคืนลูกค้า',
  },
  'status-convert': {
    accent: 'from-purple-700 to-indigo-700',
    api: '/api/stock/status-convert',
    title: 'ปรับสถานะสินค้า / Status Convert',
  },
} satisfies Record<Mode, { accent: string; api: string; title: string }>

export function StockOperationPageClient({ mode }: { mode: Mode }) {
  const meta = config[mode]
  const pathname = usePathname()
  const [data, setData] = useState<Payload>({ reference: { branches: [], products: [], warehouses: [] }, rows: [] })
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      setData(await dailyFetchJson<Payload>(meta.api))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [meta.api])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (window.location.search.includes('new=1')) setFormOpen(true)
  }, [])

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return data.rows.filter((row) => !query || Object.values(row).join(' ').toLowerCase().includes(query))
  }, [data.rows, search])

  async function submit(values: StatusConvertFormValues | StockConvertFormValues | StockAdjustFormValues | CustomerReturnFormValues) {
    setError(null)
    setIsSaving(true)
    try {
      await dailyFetchJson(meta.api, { body: JSON.stringify(values), method: 'POST' })
      setFormOpen(false)
      await loadData()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกข้อมูลไม่ได้')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className={`rounded-xl bg-gradient-to-r ${meta.accent} p-5 text-white shadow`}>
        <h1 className="text-2xl font-bold">{meta.title}</h1>
        <p className="mt-1 text-sm opacity-90">{descriptionFor(mode)}</p>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      <SummaryCards mode={mode} rows={rows} />
      <div className="rounded-lg bg-white p-3 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <input className="min-w-56 flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหาเลขที่/สินค้า/เหตุผล/สาขา" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          <a className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white" href={`${pathname}?new=1`}>+ เพิ่มรายการ</a>
          <button className="rounded bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700" type="button" onClick={() => void loadData()}>Refresh</button>
        </div>
      </div>
      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-8">
          <div className="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4"><h3 className="font-bold">{meta.title}</h3><a className="text-2xl text-slate-400" href={pathname}>&times;</a></div>
            {mode === 'status-convert' ? <StatusConvertForm cancelHref={pathname} isSaving={isSaving} reference={data.reference} onSubmit={submit} /> : null}
            {mode === 'convert' ? <ConvertForm cancelHref={pathname} isSaving={isSaving} reference={data.reference} onSubmit={submit} /> : null}
            {mode === 'adjust' ? <AdjustForm cancelHref={pathname} isSaving={isSaving} reference={data.reference} onSubmit={submit} /> : null}
            {mode === 'customer-return' ? <CustomerReturnForm cancelHref={pathname} isSaving={isSaving} reference={data.reference} onSubmit={submit} /> : null}
          </div>
        </div>
      ) : null}
      <OperationTable isLoading={isLoading} mode={mode} rows={rows} />
    </section>
  )
}

function descriptionFor(mode: Mode) {
  if (mode === 'status-convert') return 'เปลี่ยน RM/WIP/FG ด้วย stock ledger 2 ฝั่ง โดยไม่เปิดใบสั่งผลิต'
  if (mode === 'convert') return 'ตัดสินค้าต้นทางและเพิ่มสินค้าปลายทางด้วยต้นทุน WAC ของ source'
  if (mode === 'adjust') return 'ปรับยอดจากการนับจริงแบบ note-only: qty เปลี่ยน แต่ value ledger เป็น 0'
  return 'แยกของคืนลูกค้าออกจาก stock พร้อมขายด้วย not_available_for_sale'
}

function SummaryCards({ mode, rows }: { mode: Mode; rows: Payload['rows'] }) {
  const totalQty = rows.reduce((sum, row) => sum + Number(row.qty ?? row.sourceQty ?? row.diffQty ?? 0), 0)
  const totalValue = rows.reduce((sum, row) => sum + Number(row.value ?? row.valueNote ?? 0), 0)
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Metric label="รายการ" value={String(rows.length)} />
      <Metric label={mode === 'adjust' ? 'Diff รวม' : 'น้ำหนักรวม'} value={`${formatMoney(totalQty)} กก.`} />
      <Metric label="มูลค่า" value={formatMoney(totalValue)} />
      <Metric label="สถานะ" value="DB-connected" />
    </div>
  )
}

function OperationTable({ isLoading, mode, rows }: { isLoading: boolean; mode: Mode; rows: Payload['rows'] }) {
  const columns = columnsFor(mode)
  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow">
      <table className="w-full min-w-[1000px] text-sm">
        <thead className="bg-slate-100"><tr>{columns.map((column) => <th key={column.key} className="p-2 text-left">{column.label}</th>)}</tr></thead>
        <tbody>
          {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={columns.length}>กำลังโหลดข้อมูล</td></tr> : null}
          {!isLoading && rows.map((row, index) => <tr key={String(row.id ?? index)} className="border-t hover:bg-slate-50">{columns.map((column) => <td key={column.key} className="p-2">{formatCell(row[column.key])}</td>)}</tr>)}
          {!isLoading && !rows.length ? <tr><td className="p-8 text-center text-slate-400" colSpan={columns.length}>ยังไม่มีรายการ</td></tr> : null}
        </tbody>
      </table>
    </div>
  )
}

function columnsFor(mode: Mode) {
  if (mode === 'status-convert') return [
    { key: 'date', label: 'วันที่' }, { key: 'refNo', label: 'เลขที่' }, { key: 'productName', label: 'สินค้า' }, { key: 'lotNo', label: 'Lot' }, { key: 'branchName', label: 'สาขา' }, { key: 'warehouseName', label: 'คลัง' }, { key: 'qty', label: 'จำนวน' }, { key: 'statusFrom', label: 'จาก' }, { key: 'statusTo', label: 'เป็น' }, { key: 'value', label: 'มูลค่า' },
  ]
  if (mode === 'convert') return [
    { key: 'date', label: 'วันที่' }, { key: 'refNo', label: 'เลขที่' }, { key: 'sourceProduct', label: 'Source' }, { key: 'sourceQty', label: 'Qty Out' }, { key: 'targetProduct', label: 'Target' }, { key: 'targetQty', label: 'Qty In' }, { key: 'lossQty', label: 'Loss' }, { key: 'unitCost', label: 'WAC' }, { key: 'warehouseName', label: 'คลัง' }, { key: 'status', label: 'สถานะ' },
  ]
  if (mode === 'adjust') return [
    { key: 'docNo', label: 'เลขที่' }, { key: 'date', label: 'วันที่' }, { key: 'productName', label: 'สินค้า' }, { key: 'lotNo', label: 'Lot' }, { key: 'branchName', label: 'สาขา' }, { key: 'warehouseName', label: 'คลัง' }, { key: 'systemQty', label: 'ระบบ' }, { key: 'countedQty', label: 'นับจริง' }, { key: 'diffQty', label: 'Diff' }, { key: 'reason', label: 'เหตุผล' }, { key: 'status', label: 'สถานะ' },
  ]
  return [
    { key: 'productCode', label: 'รหัส' }, { key: 'productName', label: 'สินค้า' }, { key: 'branchName', label: 'สาขา' }, { key: 'warehouseName', label: 'คลัง' }, { key: 'lotNo', label: 'Lot' }, { key: 'customerName', label: 'ลูกค้า' }, { key: 'reason', label: 'เหตุผล' }, { key: 'qty', label: 'คงเหลือ' }, { key: 'sentQty', label: 'ส่งคืนแล้ว' }, { key: 'value', label: 'มูลค่า' }, { key: 'lastDate', label: 'ล่าสุด' },
  ]
}

function formatCell(value: unknown) {
  if (typeof value === 'number') return formatMoney(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value ?? '-')
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white p-3 shadow"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-lg font-bold text-slate-900">{value}</div></div>
}

function Field(props: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <label className="block text-sm font-medium">{props.label}<input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" type={props.type ?? 'text'} value={props.value} onChange={(event) => props.onChange(event.target.value)} /></label>
}

function Select(props: { label: string; onChange: (value: string) => void; options: StockOption[]; value: string }) {
  return <label className="block text-sm font-medium">{props.label}<select className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" value={props.value} onChange={(event) => props.onChange(event.target.value)}><option value="">เลือก</option>{props.options.filter((option) => option.active !== false).map((option) => <option key={option.id} value={option.id}>{option.code ? `${option.code} - ${option.name}` : option.name}</option>)}</select></label>
}

function BranchWarehouseFields({ branchId, reference, setBranchId, setWarehouseId, warehouseId }: { branchId: string; reference: Payload['reference']; setBranchId: (value: string) => void; setWarehouseId: (value: string) => void; warehouseId: string }) {
  return <>
    <Select label="สาขา" options={reference.branches} value={branchId} onChange={(value) => { setBranchId(value); setWarehouseId('') }} />
    <Select label="คลัง" options={reference.warehouses.filter((item) => !branchId || item.branchId === branchId)} value={warehouseId} onChange={setWarehouseId} />
  </>
}

function StatusConvertForm(props: { cancelHref: string; isSaving: boolean; onSubmit: (values: StatusConvertFormValues) => void; reference: Payload['reference'] }) {
  const [values, setValues] = useState<StatusConvertFormValues>({ branchId: '', date: todayDateInput(), docNo: null, fromStatus: 'RM', lotNo: null, notes: null, productId: '', qty: 0, reason: null, toStatus: 'FG', warehouseId: '' })
  return <FormShell cancelHref={props.cancelHref} isSaving={props.isSaving} onSubmit={() => props.onSubmit(values)}>
    <BaseDateDoc values={values} setValues={setValues} />
    <Select label="สินค้า" options={props.reference.products} value={values.productId} onChange={(productId) => setValues({ ...values, productId })} />
    <BranchWarehouseFields branchId={values.branchId} reference={props.reference} setBranchId={(branchId) => setValues({ ...values, branchId, warehouseId: '' })} setWarehouseId={(warehouseId) => setValues({ ...values, warehouseId })} warehouseId={values.warehouseId} />
    <Select label="จากสถานะ" options={statusOptions()} value={values.fromStatus} onChange={(fromStatus) => setValues({ ...values, fromStatus: fromStatus as StatusConvertFormValues['fromStatus'] })} />
    <Select label="เป็นสถานะ" options={statusOptions()} value={values.toStatus} onChange={(toStatus) => setValues({ ...values, toStatus: toStatus as StatusConvertFormValues['toStatus'] })} />
    <Field label="น้ำหนัก" type="number" value={String(values.qty)} onChange={(qty) => setValues({ ...values, qty: Number(qty) })} />
    <Field label="Lot" value={values.lotNo ?? ''} onChange={(lotNo) => setValues({ ...values, lotNo })} />
    <Field label="เหตุผล" value={values.reason ?? ''} onChange={(reason) => setValues({ ...values, reason })} />
  </FormShell>
}

function ConvertForm(props: { cancelHref: string; isSaving: boolean; onSubmit: (values: StockConvertFormValues) => void; reference: Payload['reference'] }) {
  const [values, setValues] = useState<StockConvertFormValues>({ branchId: '', date: todayDateInput(), docNo: null, lotNo: null, notes: null, reason: null, sourceProductId: '', sourceQty: 0, targetLotNo: null, targetProductId: '', targetQty: 0, warehouseId: '' })
  return <FormShell cancelHref={props.cancelHref} isSaving={props.isSaving} onSubmit={() => props.onSubmit(values)}>
    <BaseDateDoc values={values} setValues={setValues} />
    <Select label="สินค้าต้นทาง" options={props.reference.products} value={values.sourceProductId} onChange={(sourceProductId) => setValues({ ...values, sourceProductId })} />
    <Select label="สินค้าปลายทาง" options={props.reference.products} value={values.targetProductId} onChange={(targetProductId) => setValues({ ...values, targetProductId })} />
    <BranchWarehouseFields branchId={values.branchId} reference={props.reference} setBranchId={(branchId) => setValues({ ...values, branchId, warehouseId: '' })} setWarehouseId={(warehouseId) => setValues({ ...values, warehouseId })} warehouseId={values.warehouseId} />
    <Field label="น้ำหนักต้นทาง" type="number" value={String(values.sourceQty)} onChange={(sourceQty) => setValues({ ...values, sourceQty: Number(sourceQty) })} />
    <Field label="น้ำหนักปลายทาง" type="number" value={String(values.targetQty)} onChange={(targetQty) => setValues({ ...values, targetQty: Number(targetQty) })} />
    <Field label="Lot ต้นทาง" value={values.lotNo ?? ''} onChange={(lotNo) => setValues({ ...values, lotNo })} />
    <Field label="Lot ปลายทาง" value={values.targetLotNo ?? ''} onChange={(targetLotNo) => setValues({ ...values, targetLotNo })} />
    <Field label="เหตุผล" value={values.reason ?? ''} onChange={(reason) => setValues({ ...values, reason })} />
  </FormShell>
}

function AdjustForm(props: { cancelHref: string; isSaving: boolean; onSubmit: (values: StockAdjustFormValues) => void; reference: Payload['reference'] }) {
  const [values, setValues] = useState<StockAdjustFormValues>({ branchId: '', countedQty: 0, date: todayDateInput(), docNo: null, lotNo: null, productId: '', reason: '', remark: null, systemQty: 0, warehouseId: '' })
  return <FormShell cancelHref={props.cancelHref} isSaving={props.isSaving} onSubmit={() => props.onSubmit(values)}>
    <BaseDateDoc values={values} setValues={setValues} />
    <Select label="สินค้า" options={props.reference.products} value={values.productId} onChange={(productId) => setValues({ ...values, productId })} />
    <BranchWarehouseFields branchId={values.branchId} reference={props.reference} setBranchId={(branchId) => setValues({ ...values, branchId, warehouseId: '' })} setWarehouseId={(warehouseId) => setValues({ ...values, warehouseId })} warehouseId={values.warehouseId} />
    <Field label="Lot" value={values.lotNo ?? ''} onChange={(lotNo) => setValues({ ...values, lotNo })} />
    <Field label="ยอดในระบบ" type="number" value={String(values.systemQty)} onChange={(systemQty) => setValues({ ...values, systemQty: Number(systemQty) })} />
    <Field label="นับจริง" type="number" value={String(values.countedQty)} onChange={(countedQty) => setValues({ ...values, countedQty: Number(countedQty) })} />
    <Field label="เหตุผล" value={values.reason} onChange={(reason) => setValues({ ...values, reason })} />
  </FormShell>
}

function CustomerReturnForm(props: { cancelHref: string; isSaving: boolean; onSubmit: (values: CustomerReturnFormValues) => void; reference: Payload['reference'] }) {
  const [values, setValues] = useState<CustomerReturnFormValues>({ action: 'receive', branchId: '', customerId: null, date: todayDateInput(), deliveryRefNo: null, docNo: null, lotNo: null, notes: null, productId: '', qty: 0, reason: '', returnRowKey: null, unitCost: 0, warehouseId: '' })
  return <FormShell cancelHref={props.cancelHref} isSaving={props.isSaving} onSubmit={() => props.onSubmit(values)}>
    <BaseDateDoc values={values} setValues={setValues} />
    <Select label="สินค้า" options={props.reference.products} value={values.productId} onChange={(productId) => setValues({ ...values, productId })} />
    <Select label="ลูกค้า" options={props.reference.customers ?? []} value={values.customerId ?? ''} onChange={(customerId) => setValues({ ...values, customerId })} />
    <BranchWarehouseFields branchId={values.branchId} reference={props.reference} setBranchId={(branchId) => setValues({ ...values, branchId, warehouseId: '' })} setWarehouseId={(warehouseId) => setValues({ ...values, warehouseId })} warehouseId={values.warehouseId} />
    <Field label="น้ำหนัก" type="number" value={String(values.qty)} onChange={(qty) => setValues({ ...values, qty: Number(qty) })} />
    <Field label="ต้นทุน/กก." type="number" value={String(values.unitCost)} onChange={(unitCost) => setValues({ ...values, unitCost: Number(unitCost) })} />
    <Field label="Lot" value={values.lotNo ?? ''} onChange={(lotNo) => setValues({ ...values, lotNo })} />
    <Field label="เหตุผล" value={values.reason} onChange={(reason) => setValues({ ...values, reason })} />
  </FormShell>
}

function BaseDateDoc<T extends { date: string; docNo?: string | null }>({ setValues, values }: { setValues: (values: T) => void; values: T }) {
  return <>
    <Field label="วันที่" type="date" value={values.date} onChange={(date) => setValues({ ...values, date })} />
    <Field label="เลขที่เอกสาร" value={values.docNo ?? ''} onChange={(docNo) => setValues({ ...values, docNo })} />
  </>
}

function FormShell({ cancelHref, children, isSaving, onSubmit }: { cancelHref: string; children: React.ReactNode; isSaving: boolean; onSubmit: () => void }) {
  return <form onSubmit={(event) => { event.preventDefault(); onSubmit() }}>
    <div className="grid gap-4 p-5 md:grid-cols-2">{children}</div>
    <div className="flex justify-end gap-2 border-t px-5 py-4"><a className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100" href={cancelHref}>ยกเลิก</a><button className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={isSaving} type="submit">บันทึก</button></div>
  </form>
}

function statusOptions(): StockOption[] {
  return [{ active: true, id: 'RM', name: 'RM' }, { active: true, id: 'WIP', name: 'WIP' }, { active: true, id: 'FG', name: 'FG' }]
}
