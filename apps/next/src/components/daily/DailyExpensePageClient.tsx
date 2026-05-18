'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { dailyFetchJson, expenseFormSchema, formatMoney, todayDateInput, type DailyAccountOption, type ExpenseFormValues } from '@/lib/daily'

type CategoryOption = { active: boolean | null; id: string; name: string }
type ExpenseRow = ExpenseFormValues & {
  accountName: string
  categoryName: string
  docNo: string
  id: string
  netAmount: number
  status: string
}

type ExpensePayload = {
  accounts: DailyAccountOption[]
  categories: CategoryOption[]
  rows: ExpenseRow[]
}

const emptyForm: ExpenseFormValues = {
  accountId: null,
  amount: 0,
  branchId: null,
  categoryId: null,
  date: todayDateInput(),
  description: null,
  docNo: null,
  dueDate: null,
  id: null,
  notes: null,
  paidStatus: 'pending',
  payee: '',
  refDocNo: null,
  taxInvoiceNo: null,
  vat: 0,
  wht: 0,
}

export function DailyExpensePageClient({ dashboardOnly = false }: { dashboardOnly?: boolean }) {
  const [accounts, setAccounts] = useState<DailyAccountOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState<ExpenseFormValues>(emptyForm)
  const [formOpen, setFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [rows, setRows] = useState<ExpenseRow[]>([])
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [paidStatus, setPaidStatus] = useState('all')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await dailyFetchJson<ExpensePayload>('/api/daily/expenses')
      setAccounts(payload.accounts)
      setCategories(payload.categories)
      setRows(payload.rows)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดรายการค่าใช้จ่ายไม่ได้')
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
      .filter((row) => !categoryId || row.categoryId === categoryId)
      .filter((row) => paidStatus === 'all' || row.paidStatus === paidStatus)
      .filter((row) => !query || `${row.docNo} ${row.payee} ${row.description ?? ''}`.toLowerCase().includes(query))
      .sort((left, right) => right.date.localeCompare(left.date) || right.docNo.localeCompare(left.docNo))
  }, [categoryId, paidStatus, rows, search])

  const summary = useMemo(() => {
    const month = todayDateInput().slice(0, 7)
    const monthly = rows.filter((row) => row.date.startsWith(month))
    const byCategory = new Map<string, number>()
    for (const row of monthly) {
      byCategory.set(row.categoryName || 'ไม่ระบุหมวด', (byCategory.get(row.categoryName || 'ไม่ระบุหมวด') ?? 0) + row.netAmount)
    }
    return {
      monthlyCount: monthly.length,
      monthlyTotal: monthly.reduce((sum, row) => sum + row.netAmount, 0),
      paidTotal: rows.filter((row) => row.paidStatus === 'paid').reduce((sum, row) => sum + row.netAmount, 0),
      pendingTotal: rows.filter((row) => row.paidStatus !== 'paid').reduce((sum, row) => sum + row.netAmount, 0),
      topCategories: Array.from(byCategory, ([name, total]) => ({ name, total })).sort((left, right) => right.total - left.total).slice(0, 8),
    }
  }, [rows])

  function openCreateForm() {
    setForm({ ...emptyForm, date: todayDateInput() })
    setFieldErrors({})
    setFormOpen(true)
  }

  function openEditForm(row: ExpenseRow) {
    setForm({
      accountId: row.accountId,
      amount: row.amount,
      branchId: row.branchId,
      categoryId: row.categoryId,
      date: row.date,
      description: row.description,
      docNo: row.docNo,
      dueDate: row.dueDate,
      id: row.id,
      notes: row.notes,
      paidStatus: row.paidStatus,
      payee: row.payee,
      refDocNo: row.refDocNo,
      taxInvoiceNo: row.taxInvoiceNo,
      vat: row.vat,
      wht: row.wht,
    })
    setFieldErrors({})
    setFormOpen(true)
  }

  async function saveForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = expenseFormSchema.safeParse(form)
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])))
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await dailyFetchJson('/api/daily/expenses', {
        body: JSON.stringify(parsed.data),
        method: 'POST',
      })
      setFormOpen(false)
      await loadData()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'บันทึกค่าใช้จ่ายไม่ได้')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="ค่าใช้จ่ายเดือนนี้" value={formatMoney(summary.monthlyTotal)} note={`${summary.monthlyCount} รายการ`} />
        <SummaryCard label="รอจ่าย" value={formatMoney(summary.pendingTotal)} tone="amber" />
        <SummaryCard label="จ่ายแล้ว" value={formatMoney(summary.paidTotal)} tone="emerald" />
        <SummaryCard label="รายการทั้งหมด" value={String(rows.length)} />
      </div>

      {dashboardOnly ? (
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="mb-3 font-bold text-slate-700">หมวดค่าใช้จ่ายเดือนนี้</div>
          <div className="space-y-2">
            {summary.topCategories.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded border bg-slate-50 px-3 py-2 text-sm">
                <span>{item.name}</span>
                <span className="font-semibold text-blue-700">{formatMoney(item.total)}</span>
              </div>
            ))}
            {!summary.topCategories.length ? <div className="py-6 text-center text-sm text-slate-500">ยังไม่มีข้อมูลเดือนนี้</div> : null}
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="flex flex-wrap items-center gap-2">
              <input className="min-w-56 flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="ค้นหาเลขที่ / ผู้รับ / รายละเอียด" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
              <select className="rounded-lg border px-2 py-2 text-sm" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">ทุกหมวด</option>
                {categories.filter((category) => category.active !== false).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <select className="rounded-lg border px-2 py-2 text-sm" value={paidStatus} onChange={(event) => setPaidStatus(event.target.value)}>
                <option value="all">ทุกสถานะ</option>
                <option value="pending">รอจ่าย</option>
                <option value="paid">จ่ายแล้ว</option>
              </select>
              <button className="ml-auto rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white" type="button" onClick={openCreateForm}>+ ค่าใช้จ่าย</button>
            </div>
          </div>

          {formOpen ? (
            <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-8">
              <form noValidate className="w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl" onSubmit={saveForm}>
                <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4">
                  <h3 className="font-bold">{form.id ? 'แก้ไขค่าใช้จ่าย' : 'เพิ่มค่าใช้จ่าย'}</h3>
                  <button className="text-2xl text-slate-400" type="button" onClick={() => setFormOpen(false)}>&times;</button>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-3">
                  <TextField label="เลขที่" readOnly value={form.docNo ?? 'ระบบจะออกเลขให้'} />
                  <TextField error={fieldErrors.date} label="วันที่" required type="date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} />
                  <TextField error={fieldErrors.dueDate} label="ครบกำหนด" type="date" value={form.dueDate ?? ''} onChange={(value) => setForm({ ...form, dueDate: value })} />
                  <TextField error={fieldErrors.payee} label="ผู้รับเงิน" required value={form.payee} onChange={(value) => setForm({ ...form, payee: value })} />
                  <SelectField error={fieldErrors.categoryId} label="หมวด" value={form.categoryId ?? ''} onChange={(value) => setForm({ ...form, categoryId: value })} options={categories.filter((category) => category.active !== false).map((category) => ({ id: category.id, name: category.name }))} />
                  <SelectField error={fieldErrors.accountId} label="บัญชีจ่าย" value={form.accountId ?? ''} onChange={(value) => setForm({ ...form, accountId: value })} options={accounts.filter((account) => account.active)} />
                  <TextField error={fieldErrors.amount} label="ยอดก่อน VAT" required type="number" value={String(form.amount)} onChange={(value) => setForm({ ...form, amount: Number(value) })} />
                  <TextField error={fieldErrors.vat} label="VAT" type="number" value={String(form.vat)} onChange={(value) => setForm({ ...form, vat: Number(value) })} />
                  <TextField error={fieldErrors.wht} label="WHT" type="number" value={String(form.wht)} onChange={(value) => setForm({ ...form, wht: Number(value) })} />
                  <TextField error={fieldErrors.refDocNo} label="เลขอ้างอิง" value={form.refDocNo ?? ''} onChange={(value) => setForm({ ...form, refDocNo: value })} />
                  <TextField error={fieldErrors.taxInvoiceNo} label="เลขใบกำกับภาษี" value={form.taxInvoiceNo ?? ''} onChange={(value) => setForm({ ...form, taxInvoiceNo: value })} />
                  <label className="block text-sm font-medium">
                    สถานะ
                    <select className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.paidStatus} onChange={(event) => setForm({ ...form, paidStatus: event.target.value as 'pending' | 'paid' })}>
                      <option value="pending">รอจ่าย</option>
                      <option value="paid">จ่ายแล้ว</option>
                    </select>
                  </label>
                  <div className="md:col-span-3">
                    <TextField error={fieldErrors.description} label="รายละเอียด" value={form.description ?? ''} onChange={(value) => setForm({ ...form, description: value })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t px-5 py-4">
                  <button className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100" type="button" onClick={() => setFormOpen(false)}>ยกเลิก</button>
                  <button className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
                </div>
              </form>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <div>พบทั้งหมด <span className="font-semibold text-slate-900">{filteredRows.length}</span> รายการ · รวม <span className="font-semibold text-blue-700">{formatMoney(filteredRows.reduce((sum, row) => sum + row.netAmount, 0))}</span></div>
          </div>

          <div className="overflow-x-auto rounded-lg bg-white shadow">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left">เลขที่</th>
                  <th className="p-2 text-left">วันที่</th>
                  <th className="p-2 text-left">ผู้รับ</th>
                  <th className="p-2 text-left">หมวด</th>
                  <th className="p-2 text-left">บัญชี</th>
                  <th className="p-2 text-center">สถานะ</th>
                  <th className="p-2 text-right">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={7}>กำลังโหลดข้อมูล</td></tr> : null}
                {!isLoading && filteredRows.map((row) => (
                  <tr key={row.id} className="cursor-pointer border-t hover:bg-slate-50" onClick={() => openEditForm(row)}>
                    <td className="p-2 font-mono text-xs">{row.docNo}</td>
                    <td className="p-2">{row.date}</td>
                    <td className="p-2">{row.payee}</td>
                    <td className="p-2">{row.categoryName}</td>
                    <td className="p-2">{row.accountName}</td>
                    <td className="p-2 text-center"><span className={`rounded-full px-2 py-0.5 text-xs ${row.paidStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{row.paidStatus === 'paid' ? 'จ่ายแล้ว' : 'รอจ่าย'}</span></td>
                    <td className="p-2 text-right font-semibold">{formatMoney(row.netAmount)}</td>
                  </tr>
                ))}
                {!isLoading && filteredRows.length === 0 ? <tr><td className="p-6 text-center text-slate-500" colSpan={7}>ยังไม่มีรายการ</td></tr> : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

function SummaryCard({ label, note, tone, value }: { label: string; note?: string; tone?: 'amber' | 'emerald'; value: string }) {
  const className = tone === 'amber' ? 'bg-amber-50 text-amber-800' : tone === 'emerald' ? 'bg-emerald-50 text-emerald-800' : 'bg-white text-slate-900'
  return <div className={`rounded-lg p-4 shadow ${className}`}><div className="text-xs opacity-80">{label}</div><div className="text-xl font-bold">{value}</div>{note ? <div className="mt-1 text-xs opacity-70">{note}</div> : null}</div>
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

function SelectField(props: { error?: string; label: string; onChange: (value: string) => void; options: Array<{ id: string; name: string }>; value: string }) {
  return (
    <label className="block text-sm font-medium">
      {props.label}
      <select className={`mt-1.5 w-full rounded-lg border px-3 py-2 outline-none ${props.error ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} value={props.value} onChange={(event) => props.onChange(event.target.value)}>
        <option value="">ไม่ระบุ</option>
        {props.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
      {props.error ? <span className="mt-1 block text-xs text-red-700">{props.error}</span> : null}
    </label>
  )
}
