'use client'

import { useCallback, useEffect, useState } from 'react'
import { dailyFetchJson, formatMoney } from '@/lib/daily'

type AccountOption = { currency: string; id: string; label: string; name: string; type: string }
type CustomerOption = { id: string; label: string; name: string }
type FxRateOption = { date: string; fromCurrency: string; rate: number; toCurrency: string }
type SalesBillOption = { customerId: string | null; docNo: string; id: string; receivableBalance: number }
type Row = { amountThb: number; date: string; description: string; docNo: string; feeThb: number; id: string; status: string; type: string }
type Payload = {
  filters: {
    accounts: AccountOption[]
    customers: CustomerOption[]
    latestFxRates: FxRateOption[]
    salesBills: SalesBillOption[]
  }
  rows: Row[]
  summary: { postedRows: number; totalFeeThb: number; totalReceivedThb: number }
}

type FormState = {
  bankFeeForeign: number
  billId: string
  chargeBearer: 'OUR' | 'SHA' | 'BEN'
  customerId: string
  date: string
  fxRate: number
  invoiceAmountForeign: number
  invoiceCurrency: string
  notes: string
  payerCountry: string
  receivedAccountId: string
  receivedAmountForeign: number
  swiftRef: string
  valueDate: string
}

const today = () => new Date().toISOString().slice(0, 10)

function initialForm(): FormState {
  return {
    bankFeeForeign: 0,
    billId: '',
    chargeBearer: 'SHA',
    customerId: '',
    date: today(),
    fxRate: 1,
    invoiceAmountForeign: 0,
    invoiceCurrency: 'USD',
    notes: '',
    payerCountry: '',
    receivedAccountId: '',
    receivedAmountForeign: 0,
    swiftRef: '',
    valueDate: '',
  }
}

export function OverseasReceiptPageClient() {
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => initialForm())
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      setData(await dailyFetchJson<Payload>('/api/finance/foreign/overseas-receipt'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลด Overseas Receipt ไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const selectedAccount = data?.filters.accounts.find((account) => account.id === form.receivedAccountId)
  const receivedCurrency = selectedAccount?.currency ?? form.invoiceCurrency
  const latestRate = data?.filters.latestFxRates.find((rate) => rate.fromCurrency === receivedCurrency && rate.toCurrency === 'THB')
  const fxRate = form.fxRate || latestRate?.rate || 1
  const receivedAmountThb = form.receivedAmountForeign * fxRate
  const bankFeeThb = form.bankFeeForeign * fxRate
  const netReceived = receivedAmountThb - (form.chargeBearer === 'BEN' ? bankFeeThb : 0)
  const filteredBills = data?.filters.salesBills.filter((bill) => !form.customerId || bill.customerId === form.customerId) ?? []
  function openForm() {
    const next = initialForm()
    next.customerId = data?.filters.customers[0]?.id ?? ''
    next.receivedAccountId = data?.filters.accounts[0]?.id ?? ''
    const currency = data?.filters.accounts[0]?.currency ?? 'USD'
    next.invoiceCurrency = currency === 'THB' ? 'USD' : currency
    next.fxRate = data?.filters.latestFxRates.find((rate) => rate.fromCurrency === currency && rate.toCurrency === 'THB')?.rate ?? 1
    setForm(next)
    setShowForm(true)
  }

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        <strong>Overseas Receipt</strong> - รับเงินจากต่างประเทศ (Export Sales) เข้า FCD หรือ THB Bank พร้อมคำนวณ FX Gain/Loss อัตโนมัติ
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      <div className="flex flex-wrap justify-between gap-3">
        <h3 className="self-center text-sm text-slate-500">รายการรับเงินต่างประเทศ</h3>
        <button className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white" type="button" onClick={openForm}>+ รับเงินต่างประเทศใหม่</button>
      </div>

      <div className="overflow-x-auto rounded-md bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100"><tr><th className="p-2 text-left">เลขที่</th><th className="p-2 text-left">วันที่</th><th className="p-2 text-left">Customer</th><th className="p-2 text-left">บัญชีรับ</th><th className="p-2 text-right">รับ (Foreign)</th><th className="p-2 text-left">สกุล</th><th className="p-2 text-right">FX</th><th className="p-2 text-right">มูลค่า THB</th><th className="p-2 text-right">Bank Fee</th><th className="p-2 text-right">FX G/L</th><th className="p-2 text-center">สถานะ</th><th></th></tr></thead>
          <tbody>
            {isLoading ? <tr><td className="py-10 text-center text-slate-400" colSpan={12}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && (data?.rows.length ?? 0) === 0 ? <tr><td className="py-10 text-center text-slate-400" colSpan={12}>ยังไม่มีรายการรับเงินต่างประเทศ</td></tr> : null}
            {data?.rows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2 font-mono">{row.docNo}</td><td className="p-2">{row.date}</td><td className="p-2">{row.description || '-'}</td><td className="p-2 text-xs">-</td><td className="p-2 text-right font-medium">-</td><td className="p-2">-</td><td className="p-2 text-right">-</td><td className="p-2 text-right font-medium text-emerald-700">{formatMoney(row.amountThb)}</td><td className="p-2 text-right text-amber-700">{formatMoney(row.feeThb)}</td><td className="p-2 text-right text-emerald-700">0</td><td className="p-2 text-center"><span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">{row.status}</span></td><td className="p-2 text-right text-xs text-slate-400">Read-only</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-4">
          <div className="mx-auto my-4 max-w-2xl rounded-md bg-white shadow-2xl">
            <div className="flex justify-between border-b px-5 py-3"><h3 className="font-semibold">รับเงินจากต่างประเทศ</h3><button className="text-2xl text-slate-400" type="button" onClick={() => setShowForm(false)}>&times;</button></div>
            <div className="space-y-3 p-5 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="เลขที่"><input className="w-full rounded-md border bg-slate-50 px-2 py-1.5 font-mono" readOnly value="ORC-DRAFT" /></Field>
                <Field label="วันที่"><input className="w-full rounded-md border px-2 py-1.5" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Customer *"><select className="w-full rounded-md border px-2 py-1.5" value={form.customerId} onChange={(event) => setForm({ ...form, billId: '', customerId: event.target.value })}><option value="">--</option>{data?.filters.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.label}</option>)}</select></Field>
                <Field label="ประเทศต้นทาง"><input className="w-full rounded-md border px-2 py-1.5" value={form.payerCountry} onChange={(event) => setForm({ ...form, payerCountry: event.target.value })} /></Field>
              </div>
              <Field label="บัญชีรับเงิน *"><select className="w-full rounded-md border px-2 py-1.5" value={form.receivedAccountId} onChange={(event) => setForm({ ...form, receivedAccountId: event.target.value })}><option value="">--</option>{data?.filters.accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}</select></Field>
              <Field label="อ้างอิงบิลขาย (ถ้ามี)"><select className="w-full rounded-md border px-2 py-1.5" value={form.billId} onChange={(event) => setForm({ ...form, billId: event.target.value })}><option value="">--</option>{filteredBills.map((bill) => <option key={bill.id} value={bill.id}>{bill.docNo} - ค้าง {formatMoney(bill.receivableBalance)}</option>)}</select></Field>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="สกุลที่รับ"><input className="w-full rounded-md border bg-slate-50 px-2 py-1.5" readOnly value={receivedCurrency} /></Field>
                <Field label="FX Rate"><input className="w-full rounded-md border px-2 py-1.5 text-right" min="0" step="0.0001" type="number" value={form.fxRate} onChange={(event) => setForm({ ...form, fxRate: Number(event.target.value) })} /></Field>
                <Field label="Charge Bearer"><select className="w-full rounded-md border px-2 py-1.5" value={form.chargeBearer} onChange={(event) => setForm({ ...form, chargeBearer: event.target.value as FormState['chargeBearer'] })}><option value="OUR">OUR</option><option value="SHA">SHA</option><option value="BEN">BEN</option></select></Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="ยอดตาม Invoice (Foreign)"><input className="w-full rounded-md border px-2 py-1.5 text-right" min="0" step="0.01" type="number" value={form.invoiceAmountForeign} onChange={(event) => setForm({ ...form, invoiceAmountForeign: Number(event.target.value) })} /></Field>
                <Field label="ยอดรับจริง (Foreign) *"><input className="w-full rounded-md border px-2 py-1.5 text-right font-bold" min="0" step="0.01" type="number" value={form.receivedAmountForeign} onChange={(event) => setForm({ ...form, receivedAmountForeign: Number(event.target.value) })} /></Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="มูลค่า THB"><input className="w-full rounded-md border bg-emerald-50 px-2 py-1.5 text-right font-bold" readOnly value={formatMoney(receivedAmountThb)} /></Field>
                <Field label="Bank Fee (Foreign)"><input className="w-full rounded-md border px-2 py-1.5 text-right" min="0" step="0.01" type="number" value={form.bankFeeForeign} onChange={(event) => setForm({ ...form, bankFeeForeign: Number(event.target.value) })} /></Field>
                <Field label="Bank Fee THB"><input className="w-full rounded-md border bg-amber-50 px-2 py-1.5 text-right font-bold text-amber-700" readOnly value={formatMoney(bankFeeThb)} /></Field>
              </div>
              <div className="rounded-md bg-emerald-50 p-3 text-right text-xs">Net Received: <span className="font-bold text-emerald-700">{formatMoney(netReceived)}</span> | FX G/L: <span className="font-bold text-emerald-700">0</span></div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="SWIFT Reference"><input className="w-full rounded-md border px-2 py-1.5 font-mono" value={form.swiftRef} onChange={(event) => setForm({ ...form, swiftRef: event.target.value })} /></Field>
                <Field label="Value Date"><input className="w-full rounded-md border px-2 py-1.5" type="date" value={form.valueDate} onChange={(event) => setForm({ ...form, valueDate: event.target.value })} /></Field>
              </div>
              <Field label="หมายเหตุ"><textarea className="w-full rounded-md border px-2 py-1.5" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
            </div>
            <div className="flex justify-end gap-2 border-t bg-slate-50 px-5 py-3"><button className="px-4 py-2 text-sm" type="button" onClick={() => setShowForm(false)}>ยกเลิก</button><button className="rounded-md bg-slate-600 px-4 py-2 text-sm text-white opacity-60" disabled type="button">บันทึกร่าง</button><button className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white opacity-60" disabled type="button">รับเงิน + เพิ่ม Bank/FCD</button></div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="block"><span className="mb-1 block text-xs">{label}</span>{children}</label>
}
