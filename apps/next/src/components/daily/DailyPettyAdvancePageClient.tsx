'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { DatePickerInput } from '@/components/ui/date-picker-input'
import { ResizableTableHead } from '@/components/ui/ResizableTableHead'
import { SearchCombobox, type SearchComboboxOption } from '@/components/ui/SearchCombobox'
import { useResizableColumns, type ResizableColumnDefinition } from '@/components/ui/useResizableColumns'
import { ApiError } from '@/lib/api-client'
import { dailyFetchJson, formatMoney, pettyAdvanceFormSchema, todayDateInput, type DailyAccountOption, type PettyAdvanceFormValues } from '@/lib/daily'
import { formatDateDisplay } from '@/lib/format'

type PettyAdvanceRow = PettyAdvanceFormValues & {
  accountName: string
  canCancel: boolean
  cancelBlockedReason: string
  createdAt: string
  createdBy: string
  docNo: string
  id: string
  loanFromAccountId: string | null
  loanSourceType: 'IN_SYSTEM' | 'OUTSIDE_SYSTEM' | null
  outsideLoanFromAccountName: string | null
  outsideLoanFromAccountNo: string | null
  outsideLoanFromBankBranch: string | null
  outsideLoanFromBankName: string | null
  outsideLoanTransferMethod: 'COUNTER_DEPOSIT' | 'BANK_TRANSFER' | null
  remaining: number
  receiveAccountId: string | null
  recipientAccountLabel: string
  recipientAccountNo: string
  recipientBankAccountName: string
  recipientBankBranch: string
  recipientBankName: string
  returned: number
}

type PettyPayload = {
  accounts: DailyAccountOption[]
  bankNames: PettyAdvanceBankNameOption[]
  recipientOptions: PettyAdvanceRecipientOption[]
  rows: PettyAdvanceRow[]
}
type PettyAdvanceBankNameOption = {
  code: string
  name: string
}
type PettyAdvanceRecipientBankAccount = {
  accountName: string
  accountNo: string
  bankBranch: string
  bankName: string
  linkedAccountId: string | null
  sourceType: string
}
type PettyAdvanceRecipientOption = SearchComboboxOption & {
  type: string
}
type PettyAdvanceColumnKey = 'action' | 'amount' | 'createdAt' | 'createdBy' | 'date' | 'docNo' | 'recipientName' | 'remaining' | 'returned' | 'status' | 'type'
type PettyAdvanceSortKey = Exclude<PettyAdvanceColumnKey, 'action'>
type PettyAdvanceStatusFilter = '' | 'active' | 'cancelled' | 'closed' | 'partial_returned'
type SortDirection = 'asc' | 'desc'

const pettyAdvanceColumns: Array<ResizableColumnDefinition<PettyAdvanceColumnKey>> = [
  { key: 'docNo', defaultWidth: 160, minWidth: 130 },
  { key: 'date', defaultWidth: 150, minWidth: 120 },
  { key: 'type', defaultWidth: 150, minWidth: 120 },
  { key: 'recipientName', defaultWidth: 260, minWidth: 130 },
  { key: 'amount', defaultWidth: 110, minWidth: 90 },
  { key: 'returned', defaultWidth: 110, minWidth: 90 },
  { key: 'remaining', defaultWidth: 110, minWidth: 90 },
  { key: 'status', defaultWidth: 120, minWidth: 100 },
  { key: 'createdBy', defaultWidth: 150, minWidth: 120 },
  { key: 'createdAt', defaultWidth: 160, minWidth: 130 },
  { key: 'action', defaultWidth: 150, minWidth: 120 },
]

const pageSizeOptions = [10, 25, 50, 100]

const emptyForm: PettyAdvanceFormValues = {
  accountId: '',
  amount: 0,
  date: todayDateInput(),
  docNo: null,
  id: null,
  loanFromAccountId: null,
  loanSourceType: null,
  notes: null,
  outsideLoanFromAccountName: null,
  outsideLoanFromAccountNo: null,
  outsideLoanFromBankBranch: null,
  outsideLoanFromBankName: null,
  outsideLoanTransferMethod: null,
  receiveAccountId: null,
  recipientId: '',
  recipientName: '',
  status: 'active',
  type: 'DIRECTOR_LOAN',
}

function flattenApiFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(Object.entries(fieldErrors).map(([key, value]) => [key, value?.[0] ?? 'ข้อมูลไม่ถูกต้อง']))
}

function sanitizeMoneyDraft(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '')
  const [integerPart, ...decimalParts] = cleaned.split('.')
  if (!decimalParts.length) return integerPart
  return `${integerPart}.${decimalParts.join('').slice(0, 2)}`
}

function formatMoneyInput(value: number) {
  return value > 0 ? value.toLocaleString('th-TH', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : ''
}

function accountOptionLabel(account: DailyAccountOption) {
  return `${account.type} / ${account.name} / ${account.code ?? '-'} / ยอดคงเหลือ ${formatMoney(account.balance ?? 0)}`
}

function normalizeAccountNo(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '')
}

function typeLabel(value: PettyAdvanceFormValues['type']) {
  return value === 'DIRECTOR_LOAN' ? 'กู้กรรมการ' : 'เงินสำรองจ่าย'
}

function datePart(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 10)
}

function timePart(value: string | null | undefined) {
  if (!value || !value.includes('T')) return ''
  return value.slice(11, 16)
}

function compareText(left: string | null | undefined, right: string | null | undefined) {
  return String(left ?? '').localeCompare(String(right ?? ''), 'th')
}

function uiStatus(row: Pick<PettyAdvanceRow, 'remaining' | 'returned' | 'status'>): PettyAdvanceStatusFilter {
  if (row.status === 'cancelled') return 'cancelled'
  if (row.status === 'closed') return 'closed'
  if (row.returned > 0 && row.remaining > 0) return 'partial_returned'
  return 'active'
}

export function DailyPettyAdvancePageClient() {
  const [accounts, setAccounts] = useState<DailyAccountOption[]>([])
  const [bankNames, setBankNames] = useState<PettyAdvanceBankNameOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState<PettyAdvanceFormValues>(emptyForm)
  const [formOpen, setFormOpen] = useState(false)
  const [isCancellingId, setIsCancellingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedDocNo, setLastSavedDocNo] = useState<string | null>(null)
  const [detailRow, setDetailRow] = useState<PettyAdvanceRow | null>(null)
  const [selectedRecipientBankAccounts, setSelectedRecipientBankAccounts] = useState<PettyAdvanceRecipientBankAccount[]>([])
  const [recipientOptions, setRecipientOptions] = useState<PettyAdvanceRecipientOption[]>([])
  const [rows, setRows] = useState<PettyAdvanceRow[]>([])
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [sortKey, setSortKey] = useState<PettyAdvanceSortKey>('date')
  const [status, setStatus] = useState<PettyAdvanceStatusFilter>('active')
  const [type, setType] = useState('')
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const columnResize = useResizableColumns('daily.petty-advance.v5', pettyAdvanceColumns)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const payload = await dailyFetchJson<PettyPayload>('/api/daily/petty-advances')
      setAccounts(payload.accounts ?? [])
      setBankNames(payload.bankNames ?? [])
      setRecipientOptions(payload.recipientOptions ?? [])
      setRows(payload.rows ?? [])
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
      .filter((row) => !status || uiStatus(row) === status)
      .filter((row) => !type || row.type === type)
      .filter((row) => !dateFrom || datePart(row.date) >= dateFrom)
      .filter((row) => !dateTo || datePart(row.date) <= dateTo)
      .filter((row) => !query || `${row.docNo} ${row.recipientName} ${row.notes ?? ''}`.toLowerCase().includes(query))
  }, [dateFrom, dateTo, rows, search, status, type])

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows].sort((left, right) => {
      let result = 0
      if (sortKey === 'amount' || sortKey === 'remaining' || sortKey === 'returned') {
        result = left[sortKey] - right[sortKey]
      } else if (sortKey === 'date') {
        result = left.date.localeCompare(right.date)
      } else if (sortKey === 'createdAt') {
        result = left.createdAt.localeCompare(right.createdAt)
      } else if (sortKey === 'createdBy') {
        result = compareText(left.createdBy, right.createdBy)
      } else {
        result = compareText(String(left[sortKey] ?? ''), String(right[sortKey] ?? ''))
      }
      if (result === 0) result = right.createdAt.localeCompare(left.createdAt) || right.docNo.localeCompare(left.docNo)
      return sortDirection === 'asc' ? result : -result
    })
    return sorted
  }, [filteredRows, sortDirection, sortKey])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [currentPage, pageSize, sortedRows])

  useEffect(() => {
    setPage(1)
  }, [dateFrom, dateTo, pageSize, search, status, type])

  const summary = {
    active: rows.filter((row) => row.status === 'active').length,
    remaining: rows.filter((row) => row.status === 'active').reduce((sum, row) => sum + row.remaining, 0),
    returned: rows.reduce((sum, row) => sum + row.returned, 0),
    total: rows.reduce((sum, row) => sum + row.amount, 0),
  }

  const topRecipients = useMemo(() => {
    const byRecipient = new Map<string, { active: number; count: number; name: string; remaining: number; total: number }>()
    rows.filter((row) => row.status !== 'cancelled').forEach((row) => {
      const current = byRecipient.get(row.recipientName) ?? { active: 0, count: 0, name: row.recipientName, remaining: 0, total: 0 }
      current.count += 1
      current.total += row.amount
      if (row.status === 'active') {
        current.active += 1
        current.remaining += row.remaining
      }
      byRecipient.set(row.recipientName, current)
    })
    return Array.from(byRecipient.values()).sort((left, right) => right.remaining - left.remaining).slice(0, 10)
  }, [rows])


  const activeAccounts = useMemo(() => accounts.filter((account) => account.active), [accounts])
  const companyReceiveAccounts = useMemo(() => {
    if (form.loanSourceType !== 'IN_SYSTEM' || !form.loanFromAccountId) return activeAccounts
    return activeAccounts.filter((account) => account.id !== form.loanFromAccountId)
  }, [activeAccounts, form.loanFromAccountId, form.loanSourceType])
  const selectedRecipient = useMemo(() => recipientOptions.find((option) => option.id === form.recipientId) ?? null, [form.recipientId, recipientOptions])
  const directorLoanSourceAccounts = useMemo(() => {
    const recipientAccountNos = new Set(selectedRecipientBankAccounts.map((account) => normalizeAccountNo(account.accountNo)).filter(Boolean))
    if (recipientAccountNos.size === 0) return []
    return activeAccounts.filter((account) => recipientAccountNos.has(normalizeAccountNo(account.code)))
  }, [activeAccounts, selectedRecipientBankAccounts])
  const hasActiveFilters = Boolean(search.trim() || dateFrom || dateTo || type || status !== 'active')

  useEffect(() => {
    let isCurrent = true
    setSelectedRecipientBankAccounts([])
    if (!form.recipientId) return () => {
      isCurrent = false
    }

    dailyFetchJson<{ bankAccounts: PettyAdvanceRecipientBankAccount[] }>(`/api/daily/petty-advances?recipientAccountsFor=${encodeURIComponent(form.recipientId)}`)
      .then((payload) => {
        if (!isCurrent) return
        setSelectedRecipientBankAccounts(payload.bankAccounts ?? [])
      })
      .catch((caught) => {
        if (!isCurrent) return
        setError(caught instanceof Error ? caught.message : 'โหลดบัญชีผู้จ่ายไม่ได้')
      })

    return () => {
      isCurrent = false
    }
  }, [form.recipientId])

  useEffect(() => {
    if (form.loanSourceType !== 'IN_SYSTEM' || form.loanFromAccountId || directorLoanSourceAccounts.length === 0) return
    setForm((current) => {
      if (current.loanSourceType !== 'IN_SYSTEM' || current.loanFromAccountId) return current
      return { ...current, loanFromAccountId: directorLoanSourceAccounts[0]?.id ?? null }
    })
  }, [directorLoanSourceAccounts, form.loanFromAccountId, form.loanSourceType])

  useEffect(() => {
    if (form.loanSourceType !== 'IN_SYSTEM' || !form.loanFromAccountId || form.receiveAccountId !== form.loanFromAccountId) return
    setForm((current) => {
      if (current.loanSourceType !== 'IN_SYSTEM' || current.receiveAccountId !== current.loanFromAccountId) return current
      return { ...current, receiveAccountId: null }
    })
  }, [form.loanFromAccountId, form.loanSourceType, form.receiveAccountId])

  function handleSort(nextKey: PettyAdvanceSortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortKey(nextKey)
    setSortDirection(nextKey === 'date' ? 'desc' : 'asc')
  }

  function focusFirstField(field: string) {
    requestAnimationFrame(() => {
      const container = formRef.current?.querySelector<HTMLElement>(`[data-field="${field}"], [data-error-key="${field}"]`)
      container?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const target = container?.querySelector<HTMLElement>('input, select, textarea, button')
      target?.focus()
    })
  }

  function updateRecipient(recipientId: string) {
    const recipient = recipientOptions.find((option) => option.id === recipientId) ?? null
    setForm((current) => ({
      ...current,
      loanFromAccountId: null,
      loanSourceType: null,
      outsideLoanFromAccountName: null,
      outsideLoanFromAccountNo: null,
      outsideLoanFromBankBranch: null,
      outsideLoanFromBankName: null,
      outsideLoanTransferMethod: null,
      recipientId,
      recipientName: recipient?.label ?? '',
    }))
  }

  function openCreateForm() {
    setForm({ ...emptyForm, date: todayDateInput(), recipientId: '' })
    setFieldErrors({})
    setFormOpen(true)
  }

  async function cancelRow(row: PettyAdvanceRow) {
    if (!row.canCancel) return
    if (!window.confirm(`ยืนยันยกเลิกรายการ ${row.docNo}?`)) return
    setIsCancellingId(row.id)
    setError(null)
    try {
      await dailyFetchJson('/api/daily/petty-advances', {
        body: JSON.stringify({ id: row.id }),
        method: 'PATCH',
      })
      await loadData()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ยกเลิกรายการเงินสำรองจ่ายไม่ได้')
    } finally {
      setIsCancellingId(null)
    }
  }

  function openEditForm(row: PettyAdvanceRow) {
    setForm({
      accountId: '',
      amount: row.amount,
      date: row.date,
      docNo: row.docNo,
      id: row.id,
      loanFromAccountId: row.loanFromAccountId,
      loanSourceType: row.loanSourceType ?? (row.type === 'DIRECTOR_LOAN' ? 'IN_SYSTEM' : null),
      notes: row.notes,
      outsideLoanFromAccountName: row.outsideLoanFromAccountName,
      outsideLoanFromAccountNo: null,
      outsideLoanFromBankBranch: row.outsideLoanFromBankBranch,
      outsideLoanFromBankName: row.outsideLoanFromBankName,
      outsideLoanTransferMethod: row.outsideLoanTransferMethod,
      receiveAccountId: row.receiveAccountId,
      recipientId: row.recipientId,
      recipientName: row.recipientName,
      status: row.status,
      type: row.type,
    })
    setFieldErrors({})
    setFormOpen(true)
  }

  async function saveForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = pettyAdvanceFormSchema.safeParse({ ...form, outsideLoanFromAccountNo: null })
    if (!parsed.success) {
      const nextFieldErrors = Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message]))
      setFieldErrors(nextFieldErrors)
      const firstField = parsed.error.issues[0]?.path[0]
      if (firstField) focusFirstField(String(firstField))
      return
    }

    setIsSaving(true)
    setError(null)
    setLastSavedDocNo(null)
    try {
      const saved = await dailyFetchJson<{ id: string }>('/api/daily/petty-advances', {
        body: JSON.stringify(parsed.data),
        method: 'POST',
      })
      setLastSavedDocNo(saved.id)
      setFormOpen(false)
      await loadData()
    } catch (caught) {
      if (caught instanceof ApiError && Object.keys(caught.fieldErrors).length > 0) {
        const nextFieldErrors = flattenApiFieldErrors(caught.fieldErrors)
        setFieldErrors(nextFieldErrors)
        const firstField = Object.keys(nextFieldErrors)[0]
        if (firstField) focusFirstField(firstField)
      }
      setError(caught instanceof Error ? caught.message : 'บันทึกเงินสำรองจ่ายไม่ได้')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}
      {lastSavedDocNo ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <span>บันทึก {lastSavedDocNo} แล้ว รายการนี้รออนุมัติใน Payment Approval</span>
          <a
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
            href={`/daily/payment-approval?tab=pettyAdvance&search=${encodeURIComponent(lastSavedDocNo)}`}
          >
            เปิดคิวอนุมัติ
          </a>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4 text-sm">
        <SummaryCard label="รอคืนเงิน" tone="amber" value={String(summary.active)} />
        <SummaryCard label="ยอดยืมทั้งหมด" tone="blue" value={formatMoney(summary.total)} />
        <SummaryCard label="คืนแล้ว" tone="emerald" value={formatMoney(summary.returned)} />
        <SummaryCard className="col-span-2 lg:col-span-1" label="ยอดคงค้าง" tone="red" value={formatMoney(summary.remaining)} />
      </div>

      {topRecipients.length ? (
        <div className="rounded-md bg-white p-4 shadow">
          <div className="mb-2 font-bold text-slate-700">Top 10 ผู้รับเงินที่รอคืนเงิน</div>
          <div className="grid gap-2 text-sm md:grid-cols-2">
            {topRecipients.map((recipient) => (
              <div key={recipient.name} className="flex justify-between rounded-md border border-slate-100 bg-slate-50 p-2">
                <div><b>{recipient.name}</b> · <span className="text-xs text-slate-500">{recipient.count} ครั้ง</span></div>
                <div className={recipient.remaining > 0 ? 'font-bold text-red-700' : 'text-emerald-600'}>{formatMoney(recipient.remaining)} ค้าง</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-md bg-white p-3 shadow">
        <div className="flex flex-wrap items-center gap-2">
          <input className="h-9 min-w-[260px] flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-100" placeholder="ค้นหาเลขที่ / ผู้รับเงิน / หมายเหตุ" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          <input className="hidden h-9 rounded-md border border-slate-300 px-3 text-sm outline-none lg:block" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <span className="hidden text-xs text-slate-400 lg:inline">ถึง</span>
          <input className="hidden h-9 rounded-md border border-slate-300 px-3 text-sm outline-none lg:block" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />

          {/* Mobile Filter Button */}
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:hidden"
            onClick={() => setShowMobileFilters(true)}
          >
            <span>🔍</span> ตัวกรอง {(type || status !== 'active') ? '(1)' : ''}
          </button>

          {hasActiveFilters ? (
            <button className="h-9 rounded-md border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50" type="button" onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setType(''); setStatus('active') }}>
              ล้าง filter
            </button>
          ) : null}
          <button className="hidden lg:inline-flex items-center justify-center ml-auto h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700" type="button" onClick={openCreateForm}>+ ยืมเงินใหม่</button>
        </div>

        {/* Desktop Filters */}
        <div className="mt-3 space-y-2 hidden lg:block">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 w-14 inline-block shrink-0">ประเภท:</span>
            <SegmentFilterButton active={!type} label="ทุกประเภท" onClick={() => setType('')} />
            <SegmentFilterButton active={type === 'DIRECTOR_LOAN'} label="กู้กรรมการ" onClick={() => setType(type === 'DIRECTOR_LOAN' ? '' : 'DIRECTOR_LOAN')} />
            <SegmentFilterButton active={type === 'PETTY_CASH'} label="เงินสำรองจ่าย" onClick={() => setType(type === 'PETTY_CASH' ? '' : 'PETTY_CASH')} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 w-14 inline-block shrink-0">สถานะ:</span>
            <SegmentFilterButton active={!status} label="ทั้งหมด" onClick={() => setStatus('')} />
            <SegmentFilterButton active={status === 'active'} label="รอคืนเงิน" onClick={() => setStatus(status === 'active' ? '' : 'active')} />
            <SegmentFilterButton active={status === 'partial_returned'} label="คืนแล้วบางส่วน" onClick={() => setStatus(status === 'partial_returned' ? '' : 'partial_returned')} />
            <SegmentFilterButton active={status === 'closed'} label="คืนแล้ว" onClick={() => setStatus(status === 'closed' ? '' : 'closed')} />
            <SegmentFilterButton active={status === 'cancelled'} label="ยกเลิก" onClick={() => setStatus(status === 'cancelled' ? '' : 'cancelled')} />
          </div>
        </div>
      </div>

      {/* Floating Action Button (FAB) for Mobile */}
      <div className="fixed bottom-6 right-6 z-40 lg:hidden">
        <button
          className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg active:scale-95 transition-transform hover:bg-blue-700"
          onClick={openCreateForm}
          type="button"
          aria-label="ยืมเงินใหม่"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Bottom Sheet Filter for Mobile */}
      {showMobileFilters ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 lg:hidden">
          <div className="w-full rounded-t-2xl bg-white p-4 shadow-xl border-t border-slate-100 animate-slide-up max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h4 className="font-bold text-slate-800">ตัวกรองเพิ่มเติม</h4>
              <button
                className="p-1 text-slate-400 hover:text-slate-600 text-xl font-bold"
                onClick={() => setShowMobileFilters(false)}
                type="button"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="mb-2 block text-xs font-semibold text-slate-600">ช่วงวันที่กู้ยืม/สำรองจ่าย</span>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <input className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                  <span className="text-xs text-slate-400">ถึง</span>
                  <input className="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs font-semibold text-slate-600">ประเภท</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium flex-1 h-11 ${
                      !type ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 bg-white text-slate-700'
                    }`}
                    type="button"
                    onClick={() => setType('')}
                  >
                    ทุกประเภท
                  </button>
                  <button
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium flex-1 h-11 ${
                      type === 'DIRECTOR_LOAN' ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 bg-white text-slate-700'
                    }`}
                    type="button"
                    onClick={() => setType('DIRECTOR_LOAN')}
                  >
                    กู้กรรมการ
                  </button>
                  <button
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium flex-1 h-11 ${
                      type === 'PETTY_CASH' ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 bg-white text-slate-700'
                    }`}
                    type="button"
                    onClick={() => setType('PETTY_CASH')}
                  >
                    เงินสำรองจ่าย
                  </button>
                </div>
              </div>

              <div>
                <span className="mb-2 block text-xs font-semibold text-slate-600">สถานะ</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium h-11 ${
                      !status ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 bg-white text-slate-700'
                    }`}
                    type="button"
                    onClick={() => setStatus('')}
                  >
                    ทั้งหมด
                  </button>
                  <button
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium h-11 ${
                      status === 'active' ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 bg-white text-slate-700'
                    }`}
                    type="button"
                    onClick={() => setStatus('active')}
                  >
                    รอคืนเงิน
                  </button>
                  <button
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium h-11 ${
                      status === 'partial_returned' ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 bg-white text-slate-700'
                    }`}
                    type="button"
                    onClick={() => setStatus('partial_returned')}
                  >
                    คืนแล้วบางส่วน
                  </button>
                  <button
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium h-11 ${
                      status === 'closed' ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 bg-white text-slate-700'
                    }`}
                    type="button"
                    onClick={() => setStatus('closed')}
                  >
                    คืนแล้ว
                  </button>
                  <button
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium h-11 ${
                      status === 'cancelled' ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 bg-white text-slate-700'
                    }`}
                    type="button"
                    onClick={() => setStatus('cancelled')}
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="h-11 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setSearch('')
                  setDateFrom('')
                  setDateTo('')
                  setType('')
                  setStatus('active')
                  setShowMobileFilters(false)
                }}
              >
                ล้างตัวกรอง
              </button>
              <button
                type="button"
                className="h-11 rounded-md bg-slate-800 text-sm font-semibold text-white hover:bg-slate-700"
                onClick={() => setShowMobileFilters(false)}
              >
                ใช้ตัวกรอง
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-8">
          <form ref={formRef} noValidate className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-150" onSubmit={saveForm}>
            <div className="flex items-center justify-between bg-slate-900 px-5 py-4">
              <h3 className="font-bold text-white">{form.id ? 'แก้ไขรายการยืมเงิน' : 'สร้างรายการกู้ยืม/สำรองจ่าย'}</h3>
              <button className="text-2xl text-white/80 hover:text-white outline-none" type="button" onClick={() => setFormOpen(false)}>&times;</button>
            </div>
            <div className="space-y-5 p-5">
              <section className="space-y-3 rounded-md border border-slate-200 bg-slate-50/50 p-4">
                <h4 className="text-sm font-semibold text-slate-900">ข้อมูลการกู้ยืม/สำรองจ่าย</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <label className="block col-span-2 sm:col-span-1" data-field="type">
                    <span className="mb-1 block text-xs font-medium text-slate-600">ประเภท <span className="text-red-600">*</span></span>
                    <select className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none" value={form.type} onChange={(event) => {
                      const nextType = event.target.value as 'DIRECTOR_LOAN' | 'PETTY_CASH'
                      setForm({
                        ...form,
                        loanFromAccountId: nextType === 'DIRECTOR_LOAN' ? form.loanFromAccountId : null,
                        loanSourceType: nextType === 'DIRECTOR_LOAN' ? form.loanSourceType : null,
                        outsideLoanFromAccountName: nextType === 'DIRECTOR_LOAN' ? form.outsideLoanFromAccountName : null,
                        outsideLoanFromAccountNo: null,
                        outsideLoanFromBankBranch: nextType === 'DIRECTOR_LOAN' ? form.outsideLoanFromBankBranch : null,
                        outsideLoanFromBankName: nextType === 'DIRECTOR_LOAN' ? form.outsideLoanFromBankName : null,
                        outsideLoanTransferMethod: nextType === 'DIRECTOR_LOAN' ? form.outsideLoanTransferMethod : null,
                        receiveAccountId: nextType === 'DIRECTOR_LOAN' ? form.receiveAccountId : null,
                        type: nextType,
                      })
                    }}>
                      <option value="DIRECTOR_LOAN">กู้กรรมการ</option>
                      <option value="PETTY_CASH">เงินสำรองจ่าย</option>
                    </select>
                  </label>
                  <div className="col-span-2 sm:col-span-1">
                    <TextField error={fieldErrors.date} fieldName="date" label="วันที่กู้ยืม/สำรองจ่าย" required type="date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <MoneyField error={fieldErrors.amount} fieldName="amount" label="จำนวนเงิน" required value={form.amount} onChange={(value) => setForm({ ...form, amount: value })} />
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
                <h4 className="text-sm font-semibold text-slate-900">{form.type === 'DIRECTOR_LOAN' ? 'ผู้จ่ายและข้อมูลเงินกู้กรรมการ' : 'ผู้จ่าย / กรรมการ'}</h4>
                <div data-field="recipientId">
                  <SearchCombobox
                     error={fieldErrors.recipientId ?? fieldErrors.recipientName}
                     errorKey="recipientId"
                     inputClassName="h-9 text-sm"
                     inputId="petty-advance-recipient"
                     label="ผู้จ่าย *"
                     options={recipientOptions}
                     optionsPanelClassName="max-h-72"
                     placeholder="ค้นหารายชื่อจากข้อมูลหลักพนักงาน/กรรมการ"
                     value={form.recipientId}
                     onChange={updateRecipient}
                  />
                </div>

                {form.type === 'DIRECTOR_LOAN' ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block" data-field="loanSourceType">
                      <span className="mb-1 block text-xs font-medium text-slate-600">ประเภทเงินกู้ <span className="text-red-600">*</span></span>
                      <select
                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none disabled:bg-slate-100 disabled:text-slate-400"
                        disabled={!form.recipientId}
                        value={form.loanSourceType ?? ''}
                        onChange={(event) => {
                          const loanSourceType = event.target.value ? event.target.value as 'IN_SYSTEM' | 'OUTSIDE_SYSTEM' : null
                          setForm({
                            ...form,
                            loanFromAccountId: loanSourceType === 'IN_SYSTEM' ? form.loanFromAccountId : null,
                            loanSourceType,
                            outsideLoanFromAccountName: loanSourceType === 'OUTSIDE_SYSTEM' ? form.outsideLoanFromAccountName : null,
                            outsideLoanFromAccountNo: null,
                            outsideLoanFromBankBranch: loanSourceType === 'OUTSIDE_SYSTEM' ? form.outsideLoanFromBankBranch : null,
                            outsideLoanFromBankName: loanSourceType === 'OUTSIDE_SYSTEM' ? form.outsideLoanFromBankName : null,
                            outsideLoanTransferMethod: loanSourceType === 'OUTSIDE_SYSTEM' ? form.outsideLoanTransferMethod : null,
                          })
                        }}
                      >
                        <option value="">เลือกประเภทเงินกู้</option>
                        <option value="IN_SYSTEM">บัญชีในระบบ</option>
                        <option value="OUTSIDE_SYSTEM">บัญชีนอกระบบ</option>
                      </select>
                      {!form.recipientId ? <span className="mt-1 block text-xs text-slate-500">เลือกผู้จ่ายก่อน</span> : null}
                      {fieldErrors.loanSourceType ? <span className="mt-1 block text-xs text-red-600">{fieldErrors.loanSourceType}</span> : null}
                    </label>

                    {form.loanSourceType === 'IN_SYSTEM' ? (
                      <label className="block" data-field="loanFromAccountId">
                        <span className="mb-1 block text-xs font-medium text-slate-600">บัญชีที่กู้ <span className="text-red-600">*</span></span>
                        <select className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none disabled:bg-slate-100 disabled:text-slate-400" disabled={!form.recipientId || !form.loanSourceType} value={form.loanFromAccountId ?? ''} onChange={(event) => {
                          const loanFromAccountId = event.target.value || null
                          setForm({
                            ...form,
                            loanFromAccountId,
                            receiveAccountId: form.receiveAccountId === loanFromAccountId ? null : form.receiveAccountId,
                          })
                        }}>
                          <option value="">เลือกบัญชีกรรมการที่อยู่ในระบบ</option>
                          {directorLoanSourceAccounts.map((account) => (
                            <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>
                          ))}
                        </select>
                        {fieldErrors.loanFromAccountId ? <span className="mt-1 block text-xs text-red-600">{fieldErrors.loanFromAccountId}</span> : null}
                        {selectedRecipient && directorLoanSourceAccounts.length === 0 ? <span className="mt-1 block text-xs text-amber-700">ไม่พบบัญชีในระบบที่เลขบัญชีตรงกับกรรมการนี้</span> : null}
                      </label>
                    ) : form.loanSourceType === 'OUTSIDE_SYSTEM' ? (
                      <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                        <div className="text-xs text-slate-600">บัญชีกรรมการอยู่นอกระบบ ระบบจะเก็บข้อมูลแหล่งเงินนอกระบบเป็นประวัติ แต่บัญชีที่รับเงินเข้าบริษัทให้เลือกใน section ถัดไป</div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="block" data-field="outsideLoanTransferMethod">
                            <span className="mb-1 block text-xs font-medium text-slate-600">วิธีรับเงินนอกระบบ <span className="text-red-600">*</span></span>
                            <select className={`h-9 w-full rounded-md border px-3 text-sm outline-none ${fieldErrors.outsideLoanTransferMethod ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white'}`} value={form.outsideLoanTransferMethod ?? ''} onChange={(event) => {
                              const outsideLoanTransferMethod = event.target.value ? event.target.value as 'COUNTER_DEPOSIT' | 'BANK_TRANSFER' : null
                              setForm({
                                ...form,
                                outsideLoanFromAccountName: outsideLoanTransferMethod === 'BANK_TRANSFER' ? form.outsideLoanFromAccountName : null,
                                outsideLoanFromBankBranch: outsideLoanTransferMethod === 'BANK_TRANSFER' ? form.outsideLoanFromBankBranch : null,
                                outsideLoanFromBankName: outsideLoanTransferMethod === 'BANK_TRANSFER' ? form.outsideLoanFromBankName : null,
                                outsideLoanTransferMethod,
                              })
                            }}>
                              <option value="">เลือกวิธีรับเงิน</option>
                              <option value="COUNTER_DEPOSIT">ฝากหน้า counter</option>
                              <option value="BANK_TRANSFER">โอนเงินผ่านบัญชี</option>
                            </select>
                            {fieldErrors.outsideLoanTransferMethod ? <span className="mt-1 block text-xs text-red-600">{fieldErrors.outsideLoanTransferMethod}</span> : null}
                          </label>
                          {form.outsideLoanTransferMethod === 'BANK_TRANSFER' ? (
                            <>
                              <label className="block" data-field="outsideLoanFromBankName">
                                <span className="mb-1 block text-xs font-medium text-slate-600">ธนาคารที่โอนเข้า <span className="text-red-600">*</span></span>
                                <select className={`h-9 w-full rounded-md border px-3 text-sm outline-none ${fieldErrors.outsideLoanFromBankName ? 'border-red-300 bg-red-50' : 'border-slate-300 bg-white'}`} value={form.outsideLoanFromBankName ?? ''} onChange={(event) => setForm({ ...form, outsideLoanFromBankName: event.target.value || null })}>
                                  <option value="">เลือกธนาคาร</option>
                                  {bankNames.map((bank) => (
                                    <option key={bank.code} value={bank.name}>{bank.name}</option>
                                  ))}
                                </select>
                                {fieldErrors.outsideLoanFromBankName ? <span className="mt-1 block text-xs text-red-600">{fieldErrors.outsideLoanFromBankName}</span> : null}
                              </label>
                              <TextField error={fieldErrors.outsideLoanFromAccountName} fieldName="outsideLoanFromAccountName" label="ชื่อบัญชีที่โอนเข้า" required value={form.outsideLoanFromAccountName ?? ''} onChange={(value) => setForm({ ...form, outsideLoanFromAccountName: value || null })} />
                              <TextField error={fieldErrors.outsideLoanFromBankBranch} fieldName="outsideLoanFromBankBranch" label="สาขา" value={form.outsideLoanFromBankBranch ?? ''} onChange={(value) => setForm({ ...form, outsideLoanFromBankBranch: value || null })} />
                            </>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>

              {form.type === 'DIRECTOR_LOAN' ? (
                <section className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-semibold text-slate-900">บัญชีบริษัทที่รับเงิน</h4>
                  <label className="block" data-field="receiveAccountId">
                    <span className="mb-1 block text-xs font-medium text-slate-600">บัญชีที่รับเงินเข้าบริษัท <span className="text-red-600">*</span></span>
                    <select className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none disabled:bg-slate-100 disabled:text-slate-400" value={form.receiveAccountId ?? ''} onChange={(event) => setForm({ ...form, receiveAccountId: event.target.value || null })}>
                      <option value="">เลือกบัญชีบริษัทที่รับเงิน</option>
                      {companyReceiveAccounts.map((account) => (
                        <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>
                      ))}
                    </select>
                    {fieldErrors.receiveAccountId ? <span className="mt-1 block text-xs text-red-600">{fieldErrors.receiveAccountId}</span> : null}
                  </label>
                </section>
              ) : null}

              <div>
                <TextAreaField error={fieldErrors.notes} fieldName="notes" label="หมายเหตุ" value={form.notes ?? ''} onChange={(value) => setForm({ ...form, notes: value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <button className="rounded-md px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100/50" type="button" onClick={() => setFormOpen(false)}>ยกเลิก</button>
              <button className="rounded-md bg-blue-600 hover:bg-blue-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 transition-colors" disabled={isSaving} type="submit">{isSaving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <div>พบทั้งหมด <span className="font-semibold text-slate-900">{sortedRows.length}</span> รายการ</div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {columnResize.hasCustomWidths ? <button className="h-9 rounded-md border border-slate-300 px-3 text-sm hover:bg-slate-50" type="button" onClick={columnResize.resetColumnWidths}>คืนค่าเดิมตาราง</button> : null}
          <select className="h-9 rounded-md border border-slate-300 px-2 text-sm outline-none" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            {pageSizeOptions.map((option) => <option key={option} value={option}>{option} / หน้า</option>)}
          </select>
          <button className="h-9 rounded-md border border-slate-300 px-3 text-sm disabled:opacity-50" disabled={currentPage <= 1} type="button" onClick={() => setPage((value) => Math.max(1, value - 1))}>ก่อนหน้า</button>
          <span className="px-1 text-sm">หน้า {currentPage} / {totalPages}</span>
          <button className="h-9 rounded-md border border-slate-300 px-3 text-sm disabled:opacity-50" disabled={currentPage >= totalPages} type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>ถัดไป</button>
        </div>
      </div>

      {detailRow ? <DetailModal row={detailRow} onClose={() => setDetailRow(null)} /> : null}

      {/* Mobile Card List */}
      <div className="block lg:hidden space-y-3">
        {isLoading ? (
          <div className="rounded-md bg-white p-8 text-center text-slate-500 shadow border border-slate-100">กำลังโหลดข้อมูล</div>
        ) : null}
        {!isLoading && pagedRows.map((row) => (
          <div
            key={row.id}
            className="rounded-md border border-slate-100 bg-white p-4 shadow-sm active:bg-slate-50 cursor-pointer transition-colors"
            onClick={() => setDetailRow(row)}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="font-bold text-slate-800 text-sm">{row.docNo}</span>
              <StatusBadge row={row} />
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500 mb-3">
              <span className={row.type === 'DIRECTOR_LOAN' ? 'text-purple-700 font-semibold' : 'text-amber-700 font-semibold'}>
                {typeLabel(row.type)}
              </span>
              <span>วันที่กู้ยืม/สำรองจ่าย: {formatDateDisplay(datePart(row.date))}</span>
            </div>
            <div className="mb-2 text-xs text-slate-500">สร้างเมื่อ {formatDateDisplay(datePart(row.createdAt))} {timePart(row.createdAt) || '-'} · ผู้สร้าง {row.createdBy}</div>
            <div className="text-sm font-semibold text-slate-700 mb-3">
              {row.recipientName}
            </div>
            <div className="flex justify-between items-end border-t border-slate-100 pt-2.5">
              <div className="text-xs text-slate-500">
                {row.returned > 0 ? (
                  <span className="block">คืนแล้ว: <span className="font-semibold text-emerald-700">{formatMoney(row.returned)}</span></span>
                ) : null}
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">
                  ยอดยืม: <span className="font-semibold text-slate-700">{formatMoney(row.amount)}</span>
                </div>
                <div className="mt-0.5">
                  <span className="text-xs text-slate-500">คงค้าง: </span>
                  <span className={`font-bold text-sm tabular-nums ${row.remaining > 1 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {formatMoney(row.remaining)}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2 border-t border-slate-100 pt-3">
              {row.status === 'active' ? <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50" type="button" onClick={(event) => { event.stopPropagation(); openEditForm(row) }}>แก้ไข</button> : null}
              <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={!row.canCancel || isCancellingId === row.id} title={row.canCancel ? 'ยกเลิกรายการ' : row.cancelBlockedReason} type="button" onClick={(event) => { event.stopPropagation(); void cancelRow(row) }}>{isCancellingId === row.id ? 'กำลังยกเลิก' : 'ยกเลิก'}</button>
            </div>
          </div>
        ))}
        {!isLoading && sortedRows.length === 0 ? (
          <div className="rounded-md bg-white p-8 text-center text-slate-400 shadow border border-slate-100">ยังไม่มีรายการ</div>
        ) : null}
      </div>

      <div className="hidden lg:block overflow-hidden rounded-md border border-slate-100 bg-white shadow-sm">
        <table className="w-full text-sm" style={{ minWidth: columnResize.tableMinWidth, tableLayout: 'fixed' }}>
          <colgroup>
            {pettyAdvanceColumns.map((column) => {
              const style = columnResize.getColumnStyle(column.key);
              return <col key={column.key} style={style} />;
            })}
          </colgroup>
          <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
            <tr>
              <ResizableTableHead activeSortKey={sortKey} direction={sortDirection} label="เลขที่เอกสาร" resizeProps={columnResize.getResizeHandleProps('docNo', 'เลขที่เอกสาร')} sortKey="docNo" onSort={handleSort} />
              <ResizableTableHead activeSortKey={sortKey} direction={sortDirection} label="วันที่กู้ยืม/สำรองจ่าย" resizeProps={columnResize.getResizeHandleProps('date', 'วันที่กู้ยืม/สำรองจ่าย')} sortKey="date" onSort={handleSort} />
              <ResizableTableHead activeSortKey={sortKey} direction={sortDirection} label="ประเภท" resizeProps={columnResize.getResizeHandleProps('type', 'ประเภท')} sortKey="type" onSort={handleSort} />
              <ResizableTableHead activeSortKey={sortKey} direction={sortDirection} label="ผู้รับเงิน" resizeProps={columnResize.getResizeHandleProps('recipientName', 'ผู้รับเงิน')} sortKey="recipientName" onSort={handleSort} />
              <ResizableTableHead activeSortKey={sortKey} align="right" direction={sortDirection} label="ยอดยืม" resizeProps={columnResize.getResizeHandleProps('amount', 'ยอดยืม')} sortKey="amount" onSort={handleSort} />
              <ResizableTableHead activeSortKey={sortKey} align="right" direction={sortDirection} label="คืนแล้ว" resizeProps={columnResize.getResizeHandleProps('returned', 'คืนแล้ว')} sortKey="returned" onSort={handleSort} />
              <ResizableTableHead activeSortKey={sortKey} align="right" direction={sortDirection} label="คงค้าง" resizeProps={columnResize.getResizeHandleProps('remaining', 'คงค้าง')} sortKey="remaining" onSort={handleSort} />
              <ResizableTableHead activeSortKey={sortKey} align="center" direction={sortDirection} label="สถานะ" resizeProps={columnResize.getResizeHandleProps('status', 'สถานะ')} sortKey="status" onSort={handleSort} />
              <ResizableTableHead activeSortKey={sortKey} direction={sortDirection} label="ผู้สร้างรายการ" resizeProps={columnResize.getResizeHandleProps('createdBy', 'ผู้สร้างรายการ')} sortKey="createdBy" onSort={handleSort} />
              <ResizableTableHead activeSortKey={sortKey} direction={sortDirection} label="วันที่สร้างรายการ" resizeProps={columnResize.getResizeHandleProps('createdAt', 'วันที่สร้างรายการ')} sortKey="createdAt" onSort={handleSort} />
              <ResizableTableHead align="right" label="จัดการ" resizeProps={columnResize.getResizeHandleProps('action', 'Action')} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-semibold">
            {isLoading ? <tr><td className="p-6 text-center text-slate-500" colSpan={11}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && pagedRows.map((row) => (
              <tr key={row.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetailRow(row)}>
                <td className="p-2 font-mono text-xs">{row.docNo}</td>
                <td className="p-2">
                  <div>{formatDateDisplay(datePart(row.date))}</div>
                </td>
                <td className="p-2"><span className={row.type === 'DIRECTOR_LOAN' ? 'text-purple-700' : 'text-amber-700'}>{typeLabel(row.type)}</span></td>
                <td className="p-2 font-medium">{row.recipientName}</td>
                <td className="p-2 pr-4 text-right tabular-nums">{formatMoney(row.amount)}</td>
                <td className="p-2 pr-4 text-right text-emerald-700 tabular-nums">{formatMoney(row.returned)}</td>
                <td className={`p-2 pr-4 text-right font-bold tabular-nums ${row.remaining > 1 ? 'text-red-700' : 'text-emerald-700'}`}>{formatMoney(row.remaining)}</td>
                <td className="p-2 text-center"><StatusBadge row={row} /></td>
                <td className="p-2 text-slate-700">{row.createdBy}</td>
                <td className="p-2">
                  <div>{formatDateDisplay(datePart(row.createdAt))}</div>
                  <div className="text-[11px] font-normal text-slate-500">{timePart(row.createdAt) || '-'}</div>
                </td>
                <td className="space-x-1 whitespace-nowrap p-2 text-right">
                  {row.status === 'active' ? <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50" type="button" onClick={(event) => { event.stopPropagation(); openEditForm(row) }}>แก้ไข</button> : null}
                  <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={!row.canCancel || isCancellingId === row.id} title={row.canCancel ? 'ยกเลิกรายการ' : row.cancelBlockedReason} type="button" onClick={(event) => { event.stopPropagation(); void cancelRow(row) }}>{isCancellingId === row.id ? 'กำลังยกเลิก' : 'ยกเลิก'}</button>
                </td>
              </tr>
            ))}
            {!isLoading && sortedRows.length === 0 ? <tr><td className="p-6 text-center text-slate-500" colSpan={11}>ยังไม่มีรายการ</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function DetailModal({ onClose, row }: { onClose: () => void; row: PettyAdvanceRow }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-8" onClick={onClose}>
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl animate-in fade-in zoom-in-95 duration-150" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between bg-slate-900 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-white">รายละเอียด {row.docNo} — {row.recipientName}</h3>
            <div className="mt-0.5 text-xs text-slate-300">{typeLabel(row.type)} · วันที่กู้ยืม/สำรองจ่าย {formatDateDisplay(datePart(row.date))} · จำนวน {formatMoney(row.amount)} บาท</div>
          </div>
          <button className="text-2xl text-white/80 hover:text-white outline-none" type="button" onClick={onClose}>&times;</button>
        </div>
        <div className="space-y-4 p-5 text-sm">
          <section className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
              <h4 className="text-sm font-semibold text-slate-900">สรุปยอดเงิน</h4>
              <StatusBadge row={row} />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-md border border-blue-100 bg-blue-50/50 p-3 text-center">
                <div className="text-xs font-semibold text-blue-700">ยอดยืม</div>
                <div className="mt-1 text-lg font-bold text-blue-900">{formatMoney(row.amount)}</div>
              </div>
              <div className="rounded-md border border-emerald-100 bg-emerald-50/50 p-3 text-center">
                <div className="text-xs font-semibold text-emerald-700">คืนแล้ว</div>
                <div className="mt-1 text-lg font-bold text-emerald-900">{formatMoney(row.returned)}</div>
              </div>
              <div className="rounded-md border border-red-100 bg-red-50/50 p-3 text-center">
                <div className="text-xs font-semibold text-red-700">คงค้าง</div>
                <div className="mt-1 text-lg font-bold text-red-900">{formatMoney(row.remaining)}</div>
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
            <h4 className="border-b border-slate-100 pb-2 text-sm font-semibold text-slate-900">ข้อมูลเอกสาร</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem label="เลขที่เอกสาร" value={row.docNo} />
              <DetailItem label="ประเภท" value={typeLabel(row.type)} />
              <DetailItem label="วันที่กู้ยืม/สำรองจ่าย" value={formatDateDisplay(datePart(row.date))} />
              <DetailItem label="วันที่สร้างรายการ" value={`${formatDateDisplay(datePart(row.createdAt))} เวลา ${timePart(row.createdAt) || '-'}`} />
              <DetailItem label="ผู้สร้างรายการ" value={row.createdBy || '-'} />
            </div>
          </section>

          <section className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
            <h4 className="border-b border-slate-100 pb-2 text-sm font-semibold text-slate-900">ผู้จ่ายและข้อมูลเงินกู้</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem label="ผู้รับเงิน" value={row.recipientName || '-'} />
              <DetailItem label="บัญชีรับเงินของกรรมการ/พนักงาน" value={row.recipientAccountLabel || '-'} />
              {row.loanSourceType ? <DetailItem label="ประเภทเงินกู้" value={row.loanSourceType === 'IN_SYSTEM' ? 'บัญชีในระบบ' : 'บัญชีนอกระบบ'} /> : null}
              {row.loanSourceType === 'OUTSIDE_SYSTEM' ? <DetailItem label="วิธีรับเงินนอกระบบ" value={row.outsideLoanTransferMethod === 'COUNTER_DEPOSIT' ? 'ฝากหน้า counter' : row.outsideLoanTransferMethod === 'BANK_TRANSFER' ? 'โอนเงินผ่านบัญชี' : '-'} /> : null}
              {row.loanSourceType === 'OUTSIDE_SYSTEM' && row.outsideLoanTransferMethod === 'BANK_TRANSFER' ? <DetailItem label="บัญชีนอกระบบที่โอนเข้า" value={[row.outsideLoanFromBankName, row.outsideLoanFromAccountName, row.outsideLoanFromBankBranch ? `สาขา ${row.outsideLoanFromBankBranch}` : ''].filter(Boolean).join(' / ') || '-'} /> : null}
            </div>
          </section>

          <section className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
            <h4 className="border-b border-slate-100 pb-2 text-sm font-semibold text-slate-900">บัญชีบริษัทและหมายเหตุ</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailItem label="บัญชีบริษัทที่รับเงิน" value={row.accountName || '-'} />
              <DetailItem label="หมายเหตุ" value={row.notes || '-'} />
            </div>
          </section>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <button className="rounded-md px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100/50" type="button" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  )
}

function DetailItem({ className = '', label, value }: { className?: string; label: string; value: string }) {
  return (
    <div className={`flex flex-col py-1 ${className}`}>
      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{label}</div>
      <div className="mt-0.5 text-xs sm:text-sm font-semibold text-slate-800">{value}</div>
    </div>
  )
}

function SegmentFilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`rounded-md border px-3 py-1 text-xs font-medium ${active ? 'border-slate-700 bg-slate-700 text-white' : 'border-slate-300 bg-white hover:bg-slate-50'}`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function StatusBadge({ row }: { row: Pick<PettyAdvanceRow, 'remaining' | 'returned' | 'status'> }) {
  const status = uiStatus(row)
  if (status === 'active') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><span className="size-1.5 rounded-full bg-amber-500" />รอคืนเงิน</span>
  if (status === 'partial_returned') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><span className="size-1.5 rounded-full bg-blue-500" />คืนแล้วบางส่วน</span>
  if (status === 'closed') return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><span className="size-1.5 rounded-full bg-emerald-500" />คืนแล้ว</span>
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500"><span className="size-1.5 rounded-full bg-slate-400" />ยกเลิก</span>
}

function SummaryCard({ label, tone, value, className = '' }: { label: string; tone?: 'amber' | 'blue' | 'emerald' | 'red'; value: string; className?: string }) {
  const configs = {
    slate: {
      bg: 'bg-slate-100 text-slate-600',
      emoji: '📋',
      labelColor: 'text-slate-500',
      valueColor: 'text-slate-900',
    },
    amber: {
      bg: 'bg-amber-100 text-amber-600',
      emoji: '⏱️',
      labelColor: 'text-amber-600',
      valueColor: 'text-amber-700',
    },
    blue: {
      bg: 'bg-blue-100 text-blue-600',
      emoji: '💰',
      labelColor: 'text-blue-600',
      valueColor: 'text-blue-700',
    },
    emerald: {
      bg: 'bg-emerald-100 text-emerald-600',
      emoji: '✅',
      labelColor: 'text-emerald-600',
      valueColor: 'text-emerald-700',
    },
    red: {
      bg: 'bg-red-100 text-red-600',
      emoji: '🚨',
      labelColor: 'text-red-600',
      valueColor: 'text-red-700',
    },
  }

  const config = configs[tone || 'slate']

  return (
    <div className={`bg-white p-3 sm:p-5 border border-slate-100 rounded-xl shadow-sm flex items-center gap-2.5 sm:gap-4 ${className}`}>
      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full ${config.bg} flex items-center justify-center text-lg sm:text-xl shrink-0`}>
        {config.emoji}
      </div>
      <div>
        <div className={`text-xs ${config.labelColor}`}>{label}</div>
        <div className={`font-mono text-lg sm:text-2xl font-bold ${config.valueColor}`}>{value}</div>
      </div>
    </div>
  )
}

function ReadOnlyField(props: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-600">{props.label}</span>
      <div className="min-h-9 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">{props.value || '-'}</div>
    </div>
  )
}

function TextField(props: { error?: string; fieldName?: string; label: string; onChange?: (value: string) => void; readOnly?: boolean; required?: boolean; type?: string; value: string }) {
  return (
    <label className="block" data-field={props.fieldName}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{props.label}{props.required ? <span className="ml-1 text-red-600">*</span> : null}</span>
      {props.type === 'date'
        ? <DatePickerInput className={`h-9 w-full ${props.error ? 'border-red-400 bg-red-50' : ''}`} readOnly={props.readOnly} required={props.required} value={props.value} onChange={(value) => props.onChange?.(value)} />
        : <input aria-invalid={Boolean(props.error)} className={`h-9 w-full rounded-md border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-100 ${props.error ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-300'} ${props.readOnly ? 'bg-slate-50 text-slate-500' : 'bg-white text-slate-900'}`} readOnly={props.readOnly} required={props.required} type={props.type ?? 'text'} value={props.value} onChange={(event) => props.onChange?.(event.target.value)} />}
      {props.error ? <span className="mt-1 block text-xs text-red-700">{props.error}</span> : null}
    </label>
  )
}

function MoneyField(props: { error?: string; fieldName?: string; label: string; onChange: (value: number) => void; required?: boolean; value: number }) {
  const [draftValue, setDraftValue] = useState<string | null>(null)

  return (
    <label className="block" data-field={props.fieldName}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{props.label}{props.required ? <span className="ml-1 text-red-600">*</span> : null}</span>
      <input
        aria-invalid={Boolean(props.error)}
        className={`h-9 w-full rounded-md border bg-white px-3 text-right text-sm tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-100 ${props.error ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-300 text-slate-900'}`}
        inputMode="decimal"
        placeholder="0.00"
        required={props.required}
        type="text"
        value={draftValue ?? formatMoneyInput(props.value)}
        onBlur={(event) => {
          const nextValue = sanitizeMoneyDraft(event.target.value)
          setDraftValue(null)
          props.onChange(nextValue ? Number(nextValue) : 0)
        }}
        onChange={(event) => {
          const nextValue = sanitizeMoneyDraft(event.target.value)
          setDraftValue(nextValue)
          props.onChange(nextValue ? Number(nextValue) : 0)
        }}
        onFocus={() => setDraftValue(props.value > 0 ? String(props.value) : '')}
      />
      {props.error ? <span className="mt-1 block text-xs text-red-700">{props.error}</span> : null}
    </label>
  )
}

function SelectField(props: { error?: string; fieldName?: string; label: string; onChange: (value: string) => void; options: DailyAccountOption[]; required?: boolean; value: string }) {
  return (
    <label className="block" data-field={props.fieldName}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{props.label}{props.required ? <span className="ml-1 text-red-600">*</span> : null}</span>
      <select
        aria-invalid={Boolean(props.error)}
        className={`h-9 w-full rounded-md border bg-white px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-100 ${props.error ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-300'} ${props.value ? 'text-slate-900' : 'text-slate-400'}`}
        required={props.required}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        <option disabled={props.required} value="">{props.required ? `เลือก${props.label}` : 'ไม่ระบุ'}</option>
        {props.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
      {props.error ? <span className="mt-1 block text-xs text-red-700">{props.error}</span> : null}
    </label>
  )
}

function TextAreaField(props: { error?: string; fieldName?: string; label: string; onChange: (value: string) => void; rows?: number; value: string }) {
  return (
    <label className="block" data-field={props.fieldName}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{props.label}</span>
      <textarea
        aria-invalid={Boolean(props.error)}
        className={`w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-100 ${props.error ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-300 text-slate-900'}`}
        rows={props.rows ?? 3}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
      {props.error ? <span className="mt-1 block text-xs text-red-700">{props.error}</span> : null}
    </label>
  )
}
