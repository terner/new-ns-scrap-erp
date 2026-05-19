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

type ExpenseHeatmapRow = {
  anomaly: 'high' | 'low' | null
  avg: number
  byMonth: Record<string, number>
  deviation: number
  id: string
  latest: number
  name: string
  total: number
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
  const [periodMonths, setPeriodMonths] = useState(6)

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

  const dashboard = useMemo(() => {
    const monthList = getRecentMonths(periodMonths)
    const byCategory = new Map<string, ExpenseHeatmapRow>()

    for (const category of categories.filter((item) => item.active !== false)) {
      byCategory.set(category.id, {
        anomaly: null,
        avg: 0,
        byMonth: Object.fromEntries(monthList.map((month) => [month, 0])),
        deviation: 0,
        id: category.id,
        latest: 0,
        name: category.name || category.id,
        total: 0,
      })
    }

    byCategory.set('_uncat', {
      anomaly: null,
      avg: 0,
      byMonth: Object.fromEntries(monthList.map((month) => [month, 0])),
      deviation: 0,
      id: '_uncat',
      latest: 0,
      name: 'ไม่ระบุหมวด',
      total: 0,
    })

    for (const row of rows) {
      const month = row.date.slice(0, 7)
      if (!monthList.includes(month)) continue
      const key = row.categoryId && byCategory.has(row.categoryId) ? row.categoryId : '_uncat'
      const target = byCategory.get(key)
      if (!target) continue
      const amount = row.amount + row.vat
      target.byMonth[month] = (target.byMonth[month] ?? 0) + amount
      target.total += amount
    }

    const heatmapRows = Array.from(byCategory.values())
      .map((item) => {
        const latest = item.byMonth[monthList[monthList.length - 1]] ?? 0
        const avg = item.total / periodMonths
        const deviation = avg > 0 ? ((latest - avg) / avg) * 100 : 0
        const anomaly = avg > 0 && latest > Math.max(avg * 1.5, 5000) ? 'high' : avg > 0 && latest > 0 && latest < avg * 0.3 ? 'low' : null
        return { ...item, anomaly, avg, deviation, latest }
      })
      .filter((item) => item.total > 0)
      .sort((left, right) => right.total - left.total)

    const grandByMonth = Object.fromEntries(monthList.map((month) => [month, 0]))
    for (const item of heatmapRows) {
      for (const month of monthList) {
        grandByMonth[month] = (grandByMonth[month] ?? 0) + (item.byMonth[month] ?? 0)
      }
    }

    const monthlyTotals = monthList.map((month) => grandByMonth[month] ?? 0)
    const total = monthlyTotals.reduce((sum, value) => sum + value, 0)
    const avg = monthlyTotals.length > 0 ? total / monthlyTotals.length : 0
    const latest = monthlyTotals[monthlyTotals.length - 1] ?? 0
    const vsAvg = avg > 0 ? ((latest - avg) / avg) * 100 : 0

    return {
      anomalies: heatmapRows.filter((item) => item.anomaly),
      avg,
      grandByMonth,
      heatmapRows,
      latest,
      monthList,
      total,
      vsAvg,
    }
  }, [categories, periodMonths, rows])

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
        <>
          <div className="rounded-xl bg-gradient-to-r from-rose-700 to-orange-600 p-5 text-white shadow">
            <h1 className="text-2xl font-bold">Dashboard ค่าใช้จ่าย</h1>
            <p className="mt-1 text-sm opacity-90">สรุปแต่ละหมวดเทียบเดือนย้อนหลัง และตรวจหาความผิดปกติเทียบค่าเฉลี่ย</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 text-sm shadow">
            <span className="text-slate-600">ดูย้อนหลัง:</span>
            {[3, 6, 12].map((months) => (
              <button key={months} className={`rounded px-3 py-1.5 text-xs ${periodMonths === months ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'}`} type="button" onClick={() => setPeriodMonths(months)}>
                {months} เดือน
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-white p-3 shadow"><div className="text-xs text-slate-500">รวม {periodMonths} เดือน</div><div className="text-2xl font-bold">{formatMoney(dashboard.total)}</div></div>
            <div className="rounded-xl bg-blue-50 p-3 shadow"><div className="text-xs text-blue-700">เฉลี่ย/เดือน</div><div className="text-2xl font-bold text-blue-700">{formatMoney(dashboard.avg)}</div></div>
            <div className="rounded-xl bg-amber-50 p-3 shadow"><div className="text-xs text-amber-700">เดือนนี้</div><div className="text-2xl font-bold text-amber-700">{formatMoney(dashboard.latest)}</div></div>
            <div className={`rounded-xl p-3 shadow ${Math.abs(dashboard.vsAvg) > 20 ? dashboard.vsAvg > 0 ? 'bg-red-50' : 'bg-emerald-50' : 'bg-slate-50'}`}>
              <div className={`text-xs ${dashboard.vsAvg > 20 ? 'text-red-700' : dashboard.vsAvg < -20 ? 'text-emerald-700' : 'text-slate-700'}`}>เทียบเฉลี่ย</div>
              <div className={`text-2xl font-bold ${dashboard.vsAvg > 20 ? 'text-red-700' : dashboard.vsAvg < -20 ? 'text-emerald-700' : 'text-slate-700'}`}>{dashboard.vsAvg > 0 ? '+' : ''}{dashboard.vsAvg.toFixed(1)}%</div>
            </div>
          </div>

          {dashboard.anomalies.length > 0 ? (
            <div className="rounded-xl border-2 border-red-300 bg-gradient-to-r from-red-50 to-amber-50 p-4">
              <h3 className="mb-2 font-bold text-red-700">ตรวจพบความผิดปกติ {dashboard.anomalies.length} หมวด</h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {dashboard.anomalies.map((item) => (
                  <div key={item.id} className={`rounded border p-3 ${item.anomaly === 'high' ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className={`font-bold ${item.anomaly === 'high' ? 'text-red-700' : 'text-amber-700'}`}>{item.anomaly === 'high' ? 'สูงผิดปกติ' : 'ต่ำผิดปกติ'}: {item.name}</div>
                        <div className="mt-1 text-xs text-slate-600">เดือนนี้: <b>{formatMoney(item.latest)}</b> · เฉลี่ย: <b>{formatMoney(item.avg)}</b></div>
                      </div>
                      <div className={`text-2xl font-bold ${item.anomaly === 'high' ? 'text-red-700' : 'text-amber-700'}`}>{item.deviation > 0 ? '+' : ''}{item.deviation.toFixed(0)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">ไม่พบความผิดปกติ ค่าใช้จ่ายแต่ละหมวดอยู่ในช่วงค่าเฉลี่ย</div>
          )}

          <div className="overflow-x-auto rounded-xl bg-white shadow">
            <table className="w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="sticky left-0 bg-slate-100 p-2 text-left">หมวด</th>
                  {dashboard.monthList.map((month) => <th key={month} className="p-2 text-right">{formatMonthLabel(month)}</th>)}
                  <th className="bg-blue-100 p-2 text-right">เฉลี่ย</th>
                  <th className="bg-rose-100 p-2 text-right">รวม</th>
                  <th className="p-2 text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? <tr><td className="py-8 text-center text-slate-400" colSpan={dashboard.monthList.length + 4}>กำลังโหลดข้อมูล</td></tr> : null}
                {!isLoading && dashboard.heatmapRows.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-slate-50">
                    <td className="sticky left-0 bg-white p-2 font-medium">{item.name}</td>
                    {dashboard.monthList.map((month) => {
                      const value = item.byMonth[month] ?? 0
                      const hot = item.avg > 0 && value > item.avg * 1.5
                      const low = item.avg > 0 && value > 0 && value < item.avg * 0.5
                      return <td key={month} className={`p-2 text-right ${hot ? 'bg-red-100 font-bold text-red-700' : low ? 'bg-emerald-50 text-emerald-700' : ''}`}>{value > 0 ? formatMoney(value) : '-'}</td>
                    })}
                    <td className="bg-blue-50 p-2 text-right text-blue-700">{formatMoney(item.avg)}</td>
                    <td className="bg-rose-50 p-2 text-right font-bold text-rose-700">{formatMoney(item.total)}</td>
                    <td className="p-2 text-center">
                      {item.anomaly === 'high' ? <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">สูง</span> : item.anomaly === 'low' ? <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">ต่ำ</span> : <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">ปกติ</span>}
                    </td>
                  </tr>
                ))}
                {!isLoading && dashboard.heatmapRows.length === 0 ? <tr><td className="py-8 text-center text-slate-400" colSpan={dashboard.monthList.length + 4}>ยังไม่มีข้อมูลค่าใช้จ่าย</td></tr> : null}
              </tbody>
              {dashboard.heatmapRows.length > 0 ? (
                <tfoot className="bg-slate-100 font-bold">
                  <tr>
                    <td className="sticky left-0 bg-slate-100 p-2">รวมทุกหมวด</td>
                    {dashboard.monthList.map((month) => <td key={month} className="p-2 text-right">{formatMoney(dashboard.grandByMonth[month] ?? 0)}</td>)}
                    <td className="p-2 text-right text-blue-700">{formatMoney(dashboard.avg)}</td>
                    <td className="p-2 text-right text-rose-700">{formatMoney(dashboard.total)}</td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <b>หมายเหตุ:</b> ความผิดปกติ = เดือนนี้มากกว่า 1.5 เท่าของค่าเฉลี่ยและเกิน 5,000 บาท หรือ น้อยกว่า 30% ของค่าเฉลี่ย
          </div>
        </>
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

function getRecentMonths(count: number) {
  const current = new Date(`${todayDateInput().slice(0, 7)}-01T00:00:00`)
  return Array.from({ length: count }, (_, index) => {
    const month = new Date(current)
    month.setMonth(current.getMonth() - (count - 1 - index))
    return month.toISOString().slice(0, 7)
  })
}

function formatMonthLabel(month: string) {
  return new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit' }).format(new Date(`${month}-01T00:00:00`))
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
