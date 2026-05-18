'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, formatMoney, pettyAdvanceFormSchema, pettyAdvanceReturnFormSchema, todayDateInput, type DailyAccountOption, type PettyAdvanceFormValues } from '@/lib/daily'

type PettyAdvanceRow = PettyAdvanceFormValues & {
  accountName: string
  docNo: string
  id: string
  remaining: number
  returned: number
  spent: number
}

type PettyPayload = {
  accounts: DailyAccountOption[]
  rows: PettyAdvanceRow[]
}

const emptyForm: PettyAdvanceFormValues = {
  accountId: '',
  amount: 0,
  date: todayDateInput(),
  docNo: null,
  id: null,
  notes: null,
  recipientName: '',
  status: 'active',
  type: 'DIRECTOR_LOAN',
}

export function DailyPettyAdvancePageClient() {
  const [accounts, setAccounts] = useState<DailyAccountOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState<PettyAdvanceFormValues>(emptyForm)
  const [formOpen, setFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [returnAmount, setReturnAmount] = useState('')
  const [returningRow, setReturningRow] = useState<PettyAdvanceRow | null>(null)
  const [rows, setRows] = useState<PettyAdvanceRow[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [type, setType] = useState('')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await dailyFetchJson<PettyPayload>('/api/daily/petty-advances')
      setAccounts(payload.accounts)
      setRows(payload.rows)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดเงินสำรองจ่ายไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows
      .filter((row) => !status || row.status === status)
      .filter((row) => !type || row.type === type)
      .filter((row) => !query || `${row.docNo} ${row.recipientName} ${row.notes ?? ''}`.toLowerCase().includes(query))
      .sort((left, right) => right.date.localeCompare(left.date) || right.docNo.localeCompare(left.docNo))
  }, [rows, search, status, type])

  const summary = {
    active: rows.filter((row) => row.status === 'active').length,
    remaining: rows.filter((row) => row.status === 'active').reduce((sum, row) => sum + row.remaining, 0),
    returned: rows.reduce((sum, row) => sum + row.returned, 0),
    total: rows.reduce((sum, row) => sum + row.amount, 0),
  }

  function openCreateForm() {
    setForm({ ...emptyForm, date: todayDateInput() })
    setFieldErrors({})
    setFormOpen(true)
  }

  function openEditForm(row: PettyAdvanceRow) {
    setForm({
      accountId: row.accountId,
      amount: row.amount,
      date: row.date,
      docNo: row.docNo,
      id: row.id,
      notes: row.notes,
      recipientName: row.recipientName,
      status: row.status,
      type: row.type,
    })
    setFieldErrors({})
    setFormOpen(true)
  }

  async function saveForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = pettyAdvanceFormSchema.safeParse(form)
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])))
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await dailyFetchJson('/api/daily/petty-advances', {
        body: JSON.stringify(parsed.data),
        method: 'POST',
      })
      setFormOpen(false)
      await loadData()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกเงินสำรองจ่ายไม่ได้')
    } finally {
      setIsSaving(false)
    }
  }

  async function saveReturn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!returningRow) return
    const parsed = pettyAdvanceReturnFormSchema.safeParse({
      accountId: returningRow.accountId,
      advanceId: returningRow.id,
      amount: Number(returnAmount),
      date: todayDateInput(),
      notes: null,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'ข้อมูลคืนเงินไม่ถูกต้อง')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await dailyFetchJson('/api/daily/petty-advances/returns', {
        body: JSON.stringify(parsed.data),
        method: 'POST',
      })
      setReturningRow(null)
      setReturnAmount('')
      await loadData()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกคืนเงินไม่ได้')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="จ่ายไปทั้งหมด" value={formatMoney(summary.total)} />
        <SummaryCard label="ค้างคืน" tone="amber" value={formatMoney(summary.remaining)} />
        <SummaryCard label="คืนแล้ว" tone="emerald" value={formatMoney(summary.returned)} />
        <SummaryCard label="รายการ active" value={String(summary.active)} />
      </div>

      <div className="rounded-lg bg-white p-4 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <input className="min-w-56 flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหาเลขที่ / ผู้รับ / หมายเหตุ" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="rounded-lg border px-2 py-2 text-sm" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">ทุกประเภท</option>
            <option value="DIRECTOR_LOAN">กู้กรรมการ</option>
            <option value="PETTY_CASH">เงินสำรองจ่าย</option>
          </select>
          <select className="rounded-lg border px-2 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">ทุกสถานะ</option>
            <option value="active">ค้างคืน</option>
            <option value="closed">ปิดแล้ว</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
          <button className="ml-auto rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white" type="button" onClick={openCreateForm}>+ จ่ายล่วงหน้า</button>
        </div>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-8">
          <form noValidate className="w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl" onSubmit={saveForm}>
            <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4">
              <h3 className="font-bold">{form.id ? 'แก้ไขเงินสำรองจ่าย' : 'จ่ายเงินสำรอง / กู้กรรมการ'}</h3>
              <button className="text-2xl text-slate-400" type="button" onClick={() => setFormOpen(false)}>&times;</button>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <TextField label="เลขที่" readOnly value={form.docNo ?? 'ระบบจะออกเลขให้'} />
              <TextField error={fieldErrors.date} label="วันที่" required type="date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} />
              <label className="block text-sm font-medium">
                ประเภท <span className="text-red-600">*</span>
                <select className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as 'DIRECTOR_LOAN' | 'PETTY_CASH' })}>
                  <option value="DIRECTOR_LOAN">กู้กรรมการ</option>
                  <option value="PETTY_CASH">เงินสำรองจ่าย</option>
                </select>
              </label>
              <TextField error={fieldErrors.recipientName} label="ผู้รับเงิน" required value={form.recipientName} onChange={(value) => setForm({ ...form, recipientName: value })} />
              <TextField error={fieldErrors.amount} label="จำนวนเงิน" required type="number" value={String(form.amount)} onChange={(value) => setForm({ ...form, amount: Number(value) })} />
              <SelectField error={fieldErrors.accountId} label="บัญชีจ่ายออก" value={form.accountId} onChange={(value) => setForm({ ...form, accountId: value })} options={accounts.filter((account) => account.active)} />
              <div className="md:col-span-2">
                <TextField error={fieldErrors.notes} label="หมายเหตุ" value={form.notes ?? ''} onChange={(value) => setForm({ ...form, notes: value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100" type="button" onClick={() => setFormOpen(false)}>ยกเลิก</button>
              <button className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {returningRow ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-8">
          <form className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl" onSubmit={saveReturn}>
            <div className="border-b bg-emerald-50 px-5 py-4 font-bold text-emerald-800">คืนเงิน {returningRow.docNo}</div>
            <div className="space-y-3 p-5 text-sm">
              <div className="rounded bg-amber-50 p-3 text-amber-800">คงค้าง {formatMoney(returningRow.remaining)}</div>
              <TextField label="จำนวนเงินคืน" required type="number" value={returnAmount} onChange={setReturnAmount} />
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <button className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100" type="button" onClick={() => setReturningRow(null)}>ยกเลิก</button>
              <button className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={isSaving} type="submit">บันทึกคืนเงิน</button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <div>พบทั้งหมด <span className="font-semibold text-slate-900">{filteredRows.length}</span> รายการ</div>
      </div>

      <div className="overflow-x-auto rounded-lg bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-2 text-left">เลขที่</th>
              <th className="p-2 text-left">วันที่</th>
              <th className="p-2 text-left">ประเภท</th>
              <th className="p-2 text-left">ผู้รับเงิน</th>
              <th className="p-2 text-left">บัญชี</th>
              <th className="p-2 text-right">ยอดจ่าย</th>
              <th className="p-2 text-right">คืนแล้ว</th>
              <th className="p-2 text-right">คงค้าง</th>
              <th className="p-2 text-center">สถานะ</th>
              <th className="p-2 text-right">คืนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={10}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && filteredRows.map((row) => (
              <tr key={row.id} className="cursor-pointer border-t hover:bg-slate-50" onClick={() => openEditForm(row)}>
                <td className="p-2 font-mono text-xs">{row.docNo}</td>
                <td className="p-2">{row.date}</td>
                <td className="p-2">{row.type === 'DIRECTOR_LOAN' ? 'กู้กรรมการ' : 'เงินสำรองจ่าย'}</td>
                <td className="p-2 font-medium">{row.recipientName}</td>
                <td className="p-2">{row.accountName}</td>
                <td className="p-2 text-right">{formatMoney(row.amount)}</td>
                <td className="p-2 text-right text-emerald-700">{formatMoney(row.returned)}</td>
                <td className="p-2 text-right font-semibold text-red-700">{formatMoney(row.remaining)}</td>
                <td className="p-2 text-center"><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{row.status}</span></td>
                <td className="p-2 text-right">
                  {row.status === 'active' && row.remaining > 0 ? <button className="rounded bg-emerald-700 px-2 py-1 text-xs text-white" type="button" onClick={(event) => { event.stopPropagation(); setReturningRow(row); setReturnAmount(String(Math.max(0, row.remaining))) }}>คืนเงิน</button> : '-'}
                </td>
              </tr>
            ))}
            {!isLoading && filteredRows.length === 0 ? <tr><td className="p-6 text-center text-slate-500" colSpan={10}>ยังไม่มีรายการ</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SummaryCard({ label, tone, value }: { label: string; tone?: 'amber' | 'emerald'; value: string }) {
  const className = tone === 'amber' ? 'bg-amber-50 text-amber-800' : tone === 'emerald' ? 'bg-emerald-50 text-emerald-800' : 'bg-white text-slate-900'
  return <div className={`rounded-lg p-4 shadow ${className}`}><div className="text-xs opacity-80">{label}</div><div className="text-xl font-bold">{value}</div></div>
}

function TextField(props: { error?: string; label: string; onChange?: (value: string) => void; readOnly?: boolean; required?: boolean; type?: string; value: string }) {
  return (
    <label className="block text-sm font-medium">
      {props.label}{props.required ? <span className="text-red-600"> *</span> : null}
      <input className={`mt-1.5 w-full rounded-lg border px-3 py-2 outline-none ${props.error ? 'border-red-400 bg-red-50' : 'border-slate-300'} ${props.readOnly ? 'bg-slate-50' : ''}`} readOnly={props.readOnly} type={props.type ?? 'text'} value={props.value} onChange={(event) => props.onChange?.(event.target.value)} />
      {props.error ? <span className="mt-1 block text-xs text-red-700">{props.error}</span> : null}
    </label>
  )
}

function SelectField(props: { error?: string; label: string; onChange: (value: string) => void; options: DailyAccountOption[]; value: string }) {
  return (
    <label className="block text-sm font-medium">
      {props.label} <span className="text-red-600">*</span>
      <select className={`mt-1.5 w-full rounded-lg border px-3 py-2 outline-none ${props.error ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        <option value="">ไม่ระบุ</option>
        {props.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
      {props.error ? <span className="mt-1 block text-xs text-red-700">{props.error}</span> : null}
    </label>
  )
}
