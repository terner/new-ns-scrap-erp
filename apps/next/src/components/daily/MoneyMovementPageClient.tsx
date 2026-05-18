'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { customerReceiptFormSchema, dailyFetchJson, formatMoney, supplierPaymentFormSchema, todayDateInput, type CustomerReceiptFormValues, type DailyAccountOption, type SupplierPaymentFormValues } from '@/lib/daily'

type Party = { active: boolean | null; id: string; name: string }
type Bill = { customerId?: string | null; docNo: string; id: string; payableBalance?: number; receivableBalance?: number; supplierId?: string | null; totalAmount: number }
type MoneyRow = { accountName: string; amount: number; date: string; docNo: string; id: string; netAmount: number; notes: string; partyName: string }
type Payload = { accounts: DailyAccountOption[]; bills: Bill[]; customers?: Party[]; rows: MoneyRow[]; suppliers?: Party[] }

export function MoneyMovementPageClient({ mode }: { mode: 'payment' | 'receipt' }) {
  const [data, setData] = useState<Payload>({ accounts: [], bills: [], rows: [] })
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<SupplierPaymentFormValues | CustomerReceiptFormValues>({
    accountId: '',
    amount: 0,
    billId: null,
    date: todayDateInput(),
    discount: 0,
    docNo: null,
    fee: 0,
    id: null,
    method: null,
    notes: null,
    ...(mode === 'payment' ? { supplierId: '' } : { customerId: '' }),
    withholdingTax: 0,
  } as SupplierPaymentFormValues | CustomerReceiptFormValues)

  const apiPath = mode === 'payment' ? '/api/purchase/payments' : '/api/sales/receipts'
  const partyKey = mode === 'payment' ? 'supplierId' : 'customerId'
  const parties = mode === 'payment' ? data.suppliers ?? [] : data.customers ?? []
  const partyValue = mode === 'payment'
    ? (form as SupplierPaymentFormValues).supplierId
    : (form as CustomerReceiptFormValues).customerId

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await dailyFetchJson<Payload>(apiPath))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดข้อมูลไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [apiPath])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return data.rows.filter((row) => !query || `${row.docNo} ${row.partyName}`.toLowerCase().includes(query))
  }, [data.rows, search])

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = (mode === 'payment' ? supplierPaymentFormSchema : customerReceiptFormSchema).safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      await dailyFetchJson(apiPath, { body: JSON.stringify(parsed.data), method: 'POST' })
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
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      <div className="rounded-lg bg-white p-4 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <input className="min-w-56 flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหาเลขที่ / ชื่อ" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white" type="button" onClick={() => setFormOpen(true)}>{mode === 'payment' ? '+ จ่ายเงิน Supplier' : '+ รับเงิน Customer'}</button>
        </div>
      </div>
      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-8">
          <form className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl" onSubmit={save}>
            <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4">
              <h3 className="font-bold">{mode === 'payment' ? 'จ่ายเงิน Supplier' : 'รับเงิน Customer'}</h3>
              <button className="text-2xl text-slate-400" type="button" onClick={() => setFormOpen(false)}>&times;</button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <Field label="วันที่" type="date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} />
              <Select label={mode === 'payment' ? 'ผู้ขาย' : 'ลูกค้า'} value={partyValue} onChange={(value) => setForm({ ...form, [partyKey]: value } as SupplierPaymentFormValues | CustomerReceiptFormValues)} options={parties.filter((party) => party.active !== false)} />
              <Select label={mode === 'payment' ? 'บัญชีจ่าย' : 'บัญชีรับ'} value={form.accountId} onChange={(value) => setForm({ ...form, accountId: value })} options={data.accounts.filter((account) => account.active)} />
              <Field label={mode === 'payment' ? 'ยอดจ่าย' : 'ยอดรับ'} type="number" value={String(form.amount)} onChange={(value) => setForm({ ...form, amount: Number(value) })} />
              <Field label="WHT" type="number" value={String(form.withholdingTax)} onChange={(value) => setForm({ ...form, withholdingTax: Number(value) })} />
              <Field label="ค่าธรรมเนียม" type="number" value={String(form.fee)} onChange={(value) => setForm({ ...form, fee: Number(value) })} />
              <Field label="วิธี" value={form.method ?? ''} onChange={(value) => setForm({ ...form, method: value })} />
              <Field label="หมายเหตุ" value={form.notes ?? ''} onChange={(value) => setForm({ ...form, notes: value })} />
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100" type="button" onClick={() => setFormOpen(false)}>ยกเลิก</button>
              <button className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={isSaving} type="submit">บันทึก</button>
            </div>
          </form>
        </div>
      ) : null}
      <div className="flex text-sm text-slate-600">พบทั้งหมด <span className="mx-1 font-semibold text-slate-900">{rows.length}</span> รายการ · รวม <span className="ml-1 font-semibold text-blue-700">{formatMoney(rows.reduce((sum, row) => sum + row.netAmount, 0))}</span></div>
      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100"><tr><th className="p-2 text-left">เลขที่</th><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">ชื่อ</th><th className="p-2 text-left">บัญชี</th><th className="p-2 text-right">ยอดสุทธิ</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={5}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && rows.map((row) => <tr key={row.id} className="border-t hover:bg-slate-50"><td className="p-2 font-mono text-xs">{row.docNo}</td><td className="p-2">{row.date}</td><td className="p-2">{row.partyName}</td><td className="p-2">{row.accountName}</td><td className="p-2 text-right font-semibold">{formatMoney(row.netAmount)}</td></tr>)}
            {!isLoading && rows.length === 0 ? <tr><td className="p-6 text-center text-slate-500" colSpan={5}>ยังไม่มีรายการ</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Field(props: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <label className="block text-sm font-medium">{props.label}<input className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" type={props.type ?? 'text'} value={props.value} onChange={(event) => props.onChange(event.target.value)} /></label>
}

function Select(props: { label: string; onChange: (value: string) => void; options: Array<{ id: string; name: string }>; value: string }) {
  return <label className="block text-sm font-medium">{props.label}<select className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" value={props.value} onChange={(event) => props.onChange(event.target.value)}><option value="">ไม่ระบุ</option>{props.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
}
