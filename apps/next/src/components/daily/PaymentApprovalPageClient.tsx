'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { DatePickerInput } from '@/components/ui/date-picker-input'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { dailyFetchJson, formatMoney } from '@/lib/daily'
import { formatDateDisplay } from '@/lib/format'

type SupplierBankAccountOption = {
  accountNo: string
  bankName: string
  id: string
  isPrimary: boolean
  paymentMethod: string
}

type ApprovalApRow = {
  bankAccount: string
  bankAccounts: SupplierBankAccountOption[]
  approvalId: string | null
  approvalStatus: 'approved' | 'pending'
  approvedAmount: number
  bankName: string
  date: string
  docNo: string
  id: string
  paidAmount: number
  payableBalance: number
  supplierName: string
  totalAmount: number
}

type ApprovalExpenseRow = {
  accountName: string
  approvalId: string | null
  approvalStatus: 'approved' | 'pending'
  approvedAmount: number
  date: string
  docNo: string
  dueDate: string
  id: string
  payee: string
  refDocNo: string
  totalAmount: number
}

type ApprovalPayload = {
  apRows: ApprovalApRow[]
  expenseRows: ApprovalExpenseRow[]
}

type ApprovalTab = 'ap' | 'expense'
type ApprovalFilter = 'all' | 'pending' | 'approved'
type ApprovalSortDirection = 'asc' | 'desc'
type ApprovalSortKey = 'bankAccount' | 'date' | 'docNo' | 'dueDate' | 'paidAmount' | 'partyName' | 'payableBalance' | 'totalAmount'
type BankSelectionState = Record<string, string>
type SelectionState = Record<string, { payAmount: number; selected: boolean }>
const pageSizeOptions = [10, 25, 50, 100]
const approvalFilterOptions: Array<{ label: string; value: ApprovalFilter }> = [
  { label: 'ทั้งหมด', value: 'all' },
  { label: 'ยังไม่อนุมัติ', value: 'pending' },
  { label: 'อนุมัติแล้ว', value: 'approved' },
]

function formatDecimalWithGrouping(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function normalizeMoneyDraft(value: string) {
  return value.replace(/,/g, '')
}

function isValidMoneyDraft(value: string) {
  return /^\d*(\.\d{0,2})?$/.test(value)
}

function maxPayAmount(row: ApprovalPayload['apRows'][number] | ApprovalPayload['expenseRows'][number]) {
  return 'payableBalance' in row ? row.payableBalance : row.totalAmount
}

function bankAccountOptionLabel(account: SupplierBankAccountOption) {
  const bankBits = [account.bankName, account.accountNo].filter(Boolean)
  if (bankBits.length > 0) return bankBits.join(' / ')
  return account.paymentMethod || 'ไม่ระบุ'
}

function fallbackBankLabel(row: ApprovalApRow) {
  return [row.bankName, row.bankAccount].filter(Boolean).join(' / ')
}

export function PaymentApprovalPageClient() {
  const [data, setData] = useState<ApprovalPayload>({ apRows: [], expenseRows: [] })
  const [bankSelection, setBankSelection] = useState<BankSelectionState>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [inputDrafts, setInputDrafts] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>('pending')
  const [tab, setTab] = useState<ApprovalTab>('ap')
  const [selection, setSelection] = useState<SelectionState>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false)
  const [sortDirection, setSortDirection] = useState<ApprovalSortDirection>('desc')
  const [sortKey, setSortKey] = useState<ApprovalSortKey>('date')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await dailyFetchJson<ApprovalPayload>('/api/daily/payment-approval'))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลดรายการอนุมัติไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const availableBankAccounts = useCallback((row: ApprovalApRow) => {
    return row.bankAccounts.filter((account) => account.accountNo || account.bankName || account.paymentMethod)
  }, [])

  const currentBankAccount = useCallback((row: ApprovalApRow) => {
    const accounts = availableBankAccounts(row)
    const selectedId = bankSelection[row.id]
    if (selectedId) {
      const selected = accounts.find((account) => account.id === selectedId)
      if (selected) return selected
    }
    const matchingLegacy = accounts.find((account) => account.accountNo === row.bankAccount && account.bankName === row.bankName)
    if (matchingLegacy) return matchingLegacy
    const primary = accounts.find((account) => account.isPrimary)
    return primary ?? accounts[0] ?? null
  }, [availableBankAccounts, bankSelection])

  const currentBankLabel = useCallback((row: ApprovalApRow) => {
    const account = currentBankAccount(row)
    return account ? bankAccountOptionLabel(account) : fallbackBankLabel(row)
  }, [currentBankAccount])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const source = tab === 'ap' ? data.apRows : data.expenseRows
    return source.filter((row) => {
      const rowDate = row.date || ''
      const selected = selection[row.id]?.selected ?? false
      const bankHaystack =
        'bankAccount' in row
          ? `${currentBankLabel(row)} ${row.bankAccounts.map((account) => bankAccountOptionLabel(account)).join(' ')}`
          : `${row.accountName} ${row.refDocNo}`
      const haystack = `${row.docNo} ${'supplierName' in row ? row.supplierName : row.payee} ${bankHaystack}`.toLowerCase()
      if (query && !haystack.includes(query)) return false
      if (dateFrom && rowDate < dateFrom) return false
      if (dateTo && rowDate > dateTo) return false
      if (approvalFilter === 'approved' && row.approvalStatus !== 'approved') return false
      if (approvalFilter === 'pending' && row.approvalStatus !== 'pending') return false
      return true
    })
  }, [approvalFilter, currentBankLabel, data.apRows, data.expenseRows, dateFrom, dateTo, search, selection, tab])

  const rows = useMemo(() => {
    const collator = new Intl.Collator('th-TH', { numeric: true, sensitivity: 'base' })
    return [...filteredRows].sort((left, right) => {
      const leftValue = approvalSortValue(left, sortKey, currentBankLabel)
      const rightValue = approvalSortValue(right, sortKey, currentBankLabel)
      let base = 0
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        base = leftValue - rightValue
      } else {
        base = collator.compare(String(leftValue), String(rightValue))
      }
      return sortDirection === 'asc' ? base : -base
    })
  }, [currentBankLabel, filteredRows, sortDirection, sortKey])

  const totalRows = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [currentPage, pageSize, rows])

  const apRows = useMemo(() => pageRows.filter((row): row is ApprovalPayload['apRows'][number] => 'payableBalance' in row), [pageRows])
  const expenseRows = useMemo(() => pageRows.filter((row): row is ApprovalPayload['expenseRows'][number] => !('payableBalance' in row)), [pageRows])

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (totals, row) => {
        const totalFull = 'payableBalance' in row ? row.totalAmount : row.totalAmount
        const totalPaid = 'payableBalance' in row ? row.paidAmount : 0
        const totalRemain = 'payableBalance' in row ? row.payableBalance : row.totalAmount
        const selectedRow = selection[row.id]
        const selectedAmount = row.approvalStatus === 'pending' && selectedRow?.selected && !payAmountError(row, selectedRow.payAmount) ? selectedRow.payAmount : 0
        totals.totalFull += totalFull
        totals.totalPaid += totalPaid
        totals.totalRemain += totalRemain
        totals.selectedTotal += selectedAmount
        if (row.approvalStatus === 'pending' && selectedRow?.selected) totals.selectedCount += 1
        return totals
      },
      { selectedCount: 0, selectedTotal: 0, totalFull: 0, totalPaid: 0, totalRemain: 0 },
    )
  }, [filteredRows, selection])

  const visibleIds = useMemo(() => pageRows.map((row) => row.id), [pageRows])
  const visibleSelectedIds = useMemo(() => pageRows.filter((row) => row.approvalStatus === 'pending').map((row) => row.id), [pageRows])
  const visibleSelectedCount = visibleSelectedIds.filter((id) => selection[id]?.selected).length
  const allVisibleSelected = visibleSelectedIds.length > 0 && visibleSelectedCount === visibleSelectedIds.length

  useEffect(() => {
    setPage(1)
  }, [approvalFilter, dateFrom, dateTo, pageSize, search, sortDirection, sortKey, tab])

  function defaultPayAmount(row: ApprovalPayload['apRows'][number] | ApprovalPayload['expenseRows'][number]) {
    return 'payableBalance' in row ? row.payableBalance : row.totalAmount
  }

  function setSelected(row: ApprovalPayload['apRows'][number] | ApprovalPayload['expenseRows'][number], selected: boolean) {
    if (row.approvalStatus !== 'pending') return
    setSelection((current) => ({
      ...current,
      [row.id]: {
        payAmount: current[row.id]?.payAmount ?? defaultPayAmount(row),
        selected,
      },
    }))
  }

  function setPayAmount(row: ApprovalPayload['apRows'][number] | ApprovalPayload['expenseRows'][number], payAmount: number) {
    if (row.approvalStatus !== 'pending') return
    setSelection((current) => ({
      ...current,
      [row.id]: {
        payAmount: Number.isFinite(payAmount) ? payAmount : 0,
        selected: current[row.id]?.selected ?? false,
      },
    }))
  }

  function currentPayAmount(row: ApprovalPayload['apRows'][number] | ApprovalPayload['expenseRows'][number]) {
    return selection[row.id]?.payAmount ?? defaultPayAmount(row)
  }

  function payAmountError(row: ApprovalPayload['apRows'][number] | ApprovalPayload['expenseRows'][number], value: number) {
    if (!Number.isFinite(value) || value < 0) return 'ยอดที่จะจ่ายต้องมากกว่าหรือเท่ากับ 0'
    const maxAmount = maxPayAmount(row)
    if (value > maxAmount + 0.000001) {
      return 'payableBalance' in row
        ? `ยอดที่จะจ่ายต้องไม่เกินยอดคงเหลือ ${formatMoney(maxAmount)} บาท`
        : `ยอดที่จะจ่ายต้องไม่เกินยอดรายการ ${formatMoney(maxAmount)} บาท`
    }
    return null
  }

  function handlePayAmountFocus(row: ApprovalPayload['apRows'][number] | ApprovalPayload['expenseRows'][number]) {
    if (row.approvalStatus !== 'pending') return
    setInputDrafts((current) => ({
      ...current,
      [row.id]: normalizeMoneyDraft(current[row.id] ?? formatDecimalWithGrouping(currentPayAmount(row))),
    }))
  }

  function handlePayAmountChange(row: ApprovalPayload['apRows'][number] | ApprovalPayload['expenseRows'][number], value: string) {
    if (row.approvalStatus !== 'pending') return
    const normalized = normalizeMoneyDraft(value)
    if (!isValidMoneyDraft(normalized)) return
    setInputDrafts((current) => ({
      ...current,
      [row.id]: normalized,
    }))
    const parsed = Number(normalized)
    if (Number.isFinite(parsed)) setPayAmount(row, parsed)
  }

  function handlePayAmountBlur(row: ApprovalPayload['apRows'][number] | ApprovalPayload['expenseRows'][number]) {
    setInputDrafts((current) => ({
      ...current,
      [row.id]: formatDecimalWithGrouping(currentPayAmount(row)),
    }))
  }

  function setBankAccount(row: ApprovalApRow, accountId: string) {
    if (row.approvalStatus !== 'pending') return
    setBankSelection((current) => ({
      ...current,
      [row.id]: accountId,
    }))
  }

  function selectAllVisible() {
    setSelection((current) => {
      const next = { ...current }
      rows.filter((row) => row.approvalStatus === 'pending').forEach((row) => {
        next[row.id] = {
          payAmount: current[row.id]?.payAmount ?? defaultPayAmount(row),
          selected: true,
        }
      })
      return next
    })
  }

  function clearVisibleSelection() {
    setSelection((current) => {
      const next = { ...current }
      rows.filter((row) => row.approvalStatus === 'pending').forEach((row) => {
        if (next[row.id]) next[row.id] = { ...next[row.id], selected: false }
      })
      return next
    })
  }

  function clearFilters() {
    setSearch('')
    setDateFrom('')
    setDateTo('')
    setApprovalFilter('all')
    setSortKey('date')
    setSortDirection('desc')
  }

  function changeSort(nextKey: ApprovalSortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortKey(nextKey)
    setSortDirection(nextKey === 'partyName' || nextKey === 'bankAccount' ? 'asc' : 'desc')
  }

  const selectedPendingRows = useMemo(() => {
    return filteredRows.filter((row): row is ApprovalApRow => 'bankAccount' in row && row.approvalStatus === 'pending' && (selection[row.id]?.selected ?? false))
  }, [filteredRows, selection])

  const hasInvalidSelectedRows = selectedPendingRows.some((row) => Boolean(payAmountError(row, currentPayAmount(row))))
  const canApproveSelected = tab === 'ap' && selectedPendingRows.length > 0 && !hasInvalidSelectedRows && !isSubmittingApproval

  async function approveSelected() {
    if (!canApproveSelected) return
    setIsSubmittingApproval(true)
    setError(null)
    try {
      await dailyFetchJson('/api/daily/payment-approval', {
        body: JSON.stringify({
          items: selectedPendingRows.map((row) => ({
            approvedAmount: currentPayAmount(row),
            bankAccountId: currentBankAccount(row)?.id ?? '',
            sourceId: row.id,
            sourceType: 'purchase_bill',
          })),
        }),
        method: 'POST',
      })
      setSelection({})
      setInputDrafts({})
      await loadData()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'อนุมัติโอนเงินไม่ได้')
    } finally {
      setIsSubmittingApproval(false)
    }
  }

  return (
    <section className="space-y-4">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div> : null}

      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
        <div className="rounded-md bg-slate-50 p-2"><div className="text-xs text-slate-500">รายการทั้งหมด</div><div className="font-bold">{filteredRows.length}</div></div>
        <div className="rounded-md bg-blue-50 p-2"><div className="text-xs text-blue-600">ยอดเต็ม</div><div className="font-bold text-blue-700">{formatMoney(summary.totalFull)}</div></div>
        <div className="rounded-md bg-emerald-50 p-2"><div className="text-xs text-emerald-600">ชำระแล้ว</div><div className="font-bold text-emerald-700">{formatMoney(summary.totalPaid)}</div></div>
        <div className="rounded-md bg-red-50 p-2"><div className="text-xs text-red-600">คงเหลือ</div><div className="font-bold text-red-700">{formatMoney(summary.totalRemain)}</div></div>
        <div className="rounded-md bg-amber-50 p-2"><div className="text-xs text-amber-600">เลือกจ่าย ({summary.selectedCount})</div><div className="font-bold text-amber-700">{formatMoney(summary.selectedTotal)}</div></div>
      </div>

      <div className="overflow-hidden rounded-md bg-white shadow">
        <div className="flex border-b">
          <button className={`border-b-2 px-5 py-3 text-sm font-medium ${tab === 'ap' ? 'border-red-600 text-red-700' : 'border-transparent text-slate-500'}`} type="button" onClick={() => setTab('ap')}>
            ต้นทุน (AP / บิลซื้อ) <span className="ml-2 rounded-md-full bg-red-100 px-2 py-0.5 text-xs text-red-700">{data.apRows.length}</span>
          </button>
          <button className={`border-b-2 px-5 py-3 text-sm font-medium ${tab === 'expense' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500'}`} type="button" onClick={() => setTab('expense')}>
            ค่าใช้จ่าย <span className="ml-2 rounded-md-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">{data.expenseRows.length}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-3">
          <div className="text-sm text-slate-600">
            เลือก <span className="font-semibold text-slate-900">{summary.selectedCount}</span> รายการ ยอดรวม{' '}
            <span className="font-semibold text-red-700">{formatMoney(summary.selectedTotal)} บาท</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300" disabled={!canApproveSelected} type="button" onClick={() => void approveSelected()}>{isSubmittingApproval ? 'กำลังอนุมัติ...' : 'อนุมัติที่เลือก'}</button>
            <button className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300" disabled title="รอออกแบบเอกสาร approval sheet ก่อนเปิดใช้งาน" type="button">พิมพ์ใบอนุมัติส่ง Cashier</button>
          </div>
        </div>

        <div className="space-y-3 border-b p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input className="min-w-[260px] flex-1 rounded-md" placeholder="ค้นหาเลขที่ / ชื่อ / บัญชี..." type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
            <label className="text-xs text-slate-500">วันที่:</label>
            <DatePickerInput id="payment-approval-date-from" value={dateFrom} onChange={setDateFrom} />
            <span className="text-slate-400">→</span>
            <DatePickerInput id="payment-approval-date-to" value={dateTo} onChange={setDateTo} />
            {(search || dateFrom || dateTo || approvalFilter !== 'all' || sortKey !== 'date' || sortDirection !== 'desc') ? <Button size="xs" type="button" variant="secondary" onClick={clearFilters}>✕ ล้าง</Button> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {approvalFilterOptions.map((option) => {
              const active = approvalFilter === option.value
              return (
                <button
                  key={option.value}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${active ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
                  type="button"
                  onClick={() => setApprovalFilter(option.value)}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm text-slate-600">
          <div>พบทั้งหมด <span className="font-semibold text-slate-900">{totalRows}</span> รายการ</div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="จำนวนรายการต่อหน้า"
              className="h-9 w-auto px-2 py-1"
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              {pageSizeOptions.map((size) => <option key={size} value={size}>{size} / หน้า</option>)}
            </Select>
            <Button disabled={currentPage <= 1} size="sm" type="button" variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))}>ก่อนหน้า</Button>
            <span className="px-1">หน้า {currentPage} / {totalPages}</span>
            <Button disabled={currentPage >= totalPages} size="sm" type="button" variant="outline" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>ถัดไป</Button>
          </div>
        </div>

        <div>
          {tab === 'ap' ? (
            <Table>
              <TableHeader>
                <tr>
                  <TableHead className="w-8"><input checked={allVisibleSelected} className="h-4 w-4 rounded-md border-slate-300" type="checkbox" onChange={(event) => (event.target.checked ? selectAllVisible() : clearVisibleSelection())} /></TableHead>
                  <SortableHead align="left" currentKey={sortKey} direction={sortDirection} label="เลขที่บิล" sortKey="docNo" onSort={changeSort} />
                  <SortableHead align="left" currentKey={sortKey} direction={sortDirection} label="วันที่" sortKey="date" onSort={changeSort} />
                  <SortableHead align="left" currentKey={sortKey} direction={sortDirection} label="ผู้ขาย" sortKey="partyName" onSort={changeSort} />
                  <SortableHead align="left" currentKey={sortKey} direction={sortDirection} label="บัญชีธนาคาร" sortKey="bankAccount" onSort={changeSort} />
                  <SortableHead align="right" currentKey={sortKey} direction={sortDirection} label="ยอดเต็ม" sortKey="totalAmount" onSort={changeSort} />
                  <SortableHead align="right" currentKey={sortKey} direction={sortDirection} label="ชำระแล้ว" sortKey="paidAmount" onSort={changeSort} />
                  <SortableHead align="right" currentKey={sortKey} direction={sortDirection} label="คงเหลือ" sortKey="payableBalance" onSort={changeSort} />
                  <TableHead className="w-36 text-right">ยอดที่จะจ่าย</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell className="p-6 text-center text-slate-500" colSpan={10}>กำลังโหลดข้อมูล</TableCell></TableRow> : null}
                {!isLoading && apRows.map((row) => {
                  const selectedRow = selection[row.id]
                  const fieldError = payAmountError(row, currentPayAmount(row))
                  return (
                    <TableRow key={row.id} className={`border-0 hover:bg-slate-50 ${selectedRow?.selected ? 'bg-emerald-50/60' : ''}`}>
                      <TableCell><input checked={selectedRow?.selected ?? false} className="h-4 w-4 rounded-md border-slate-300" disabled={row.approvalStatus !== 'pending'} type="checkbox" onChange={(event) => setSelected(row, event.target.checked)} /></TableCell>
                      <TableCell className="text-xs font-medium whitespace-nowrap">{row.docNo}</TableCell>
                      <TableCell className="text-xs">{formatDateDisplay(row.date)}</TableCell>
                      <TableCell className="font-semibold">{row.supplierName}</TableCell>
                      <TableCell>
                        {availableBankAccounts(row).length > 0 ? (
                          <Select
                            aria-label={`เลือกบัญชีธนาคารของ ${row.supplierName}`}
                            className="h-9 min-w-[240px] text-sm"
                            disabled={row.approvalStatus !== 'pending' || availableBankAccounts(row).length <= 1}
                            value={currentBankAccount(row)?.id ?? ''}
                            onChange={(event) => setBankAccount(row, event.target.value)}
                          >
                            {availableBankAccounts(row).map((account) => (
                              <option key={account.id} value={account.id}>
                                {bankAccountOptionLabel(account)}
                              </option>
                            ))}
                          </Select>
                        ) : currentBankLabel(row) ? (
                          <div className="select-all whitespace-nowrap text-sm text-slate-700">{currentBankLabel(row)}</div>
                        ) : (
                          <span className="text-xs text-red-500">ไม่ระบุ</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatMoney(row.totalAmount)}</TableCell>
                      <TableCell className="text-right text-emerald-700">{formatMoney(row.paidAmount)}</TableCell>
                      <TableCell className="text-right font-bold text-red-700">{formatMoney(row.payableBalance)}</TableCell>
                      <TableCell className="w-36 text-right">
                        <div className="ml-auto w-28">
                          <Input
                            className={`bg-amber-50 px-2 py-1 text-right text-xs ${fieldError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                            disabled={row.approvalStatus !== 'pending'}
                            inputMode="decimal"
                            type="text"
                            value={inputDrafts[row.id] ?? formatDecimalWithGrouping(currentPayAmount(row))}
                            onBlur={() => handlePayAmountBlur(row)}
                            onChange={(event) => handlePayAmountChange(row, event.target.value)}
                            onFocus={() => handlePayAmountFocus(row)}
                          />
                          {fieldError ? <div className="mt-1 text-right text-[11px] text-red-600">{fieldError}</div> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        <span className={`inline-flex items-center gap-1 ${row.approvalStatus === 'approved' ? 'text-emerald-700' : 'text-slate-500'}`}>
                          <span className={`h-2 w-2 rounded-full ${row.approvalStatus === 'approved' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          {row.approvalStatus === 'approved' ? 'อนุมัติแล้ว' : 'ยังไม่อนุมัติ'}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!isLoading && totalRows === 0 ? <TableRow><TableCell className="p-6 text-center text-slate-500" colSpan={10}>ไม่มีบิลค้างจ่าย</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <tr>
                  <TableHead className="w-8"><input checked={allVisibleSelected} className="h-4 w-4 rounded-md border-slate-300" type="checkbox" onChange={(event) => (event.target.checked ? selectAllVisible() : clearVisibleSelection())} /></TableHead>
                  <SortableHead align="left" currentKey={sortKey} direction={sortDirection} label="เลขที่/วันที่" sortKey="docNo" onSort={changeSort} />
                  <SortableHead align="left" currentKey={sortKey} direction={sortDirection} label="ครบกำหนด" sortKey="dueDate" onSort={changeSort} />
                  <SortableHead align="left" currentKey={sortKey} direction={sortDirection} label="ผู้รับเงิน" sortKey="partyName" onSort={changeSort} />
                  <SortableHead align="left" currentKey={sortKey} direction={sortDirection} label="บัญชี / ธนาคาร" sortKey="bankAccount" onSort={changeSort} />
                  <TableHead>รายละเอียด / อ้างอิง</TableHead>
                  <SortableHead align="right" currentKey={sortKey} direction={sortDirection} label="ยอดเต็ม" sortKey="totalAmount" onSort={changeSort} />
                  <TableHead className="w-36 text-right">ยอดที่จะจ่าย</TableHead>
                  <TableHead className="text-center">สถานะ</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell className="p-6 text-center text-slate-500" colSpan={9}>กำลังโหลดข้อมูล</TableCell></TableRow> : null}
                {!isLoading && expenseRows.map((row) => {
                  const selectedRow = selection[row.id]
                  const overdue = row.dueDate ? row.dueDate < new Date().toISOString().slice(0, 10) : false
                  const fieldError = payAmountError(row, currentPayAmount(row))
                  return (
                    <TableRow key={row.id} className={`border-0 hover:bg-slate-50 ${selectedRow?.selected ? 'bg-emerald-50/60' : ''}`}>
                      <TableCell><input checked={selectedRow?.selected ?? false} className="h-4 w-4 rounded-md border-slate-300" disabled={row.approvalStatus !== 'pending'} type="checkbox" onChange={(event) => setSelected(row, event.target.checked)} /></TableCell>
                      <TableCell className="text-xs"><div className="font-medium whitespace-nowrap">{row.docNo}</div><div className="text-slate-500">{formatDateDisplay(row.date)}</div></TableCell>
                      <TableCell className="text-xs">{row.dueDate ? <span className={overdue ? 'font-bold text-red-600' : 'text-slate-700'}>{formatDateDisplay(row.dueDate)}{overdue ? <span className="block text-[10px] text-red-500">เลยกำหนด</span> : null}</span> : <span className="text-slate-300">-</span>}</TableCell>
                      <TableCell className="font-semibold">{row.payee}</TableCell>
                      <TableCell>{row.accountName ? <span className="whitespace-nowrap text-sm text-slate-700">{row.accountName}</span> : <span className="text-xs text-amber-600">ไม่มี - แก้ที่บิลหรือ Master</span>}</TableCell>
                      <TableCell className="text-xs">{row.refDocNo ? <div className="text-slate-700">{row.refDocNo}</div> : <span className="text-slate-300">-</span>}</TableCell>
                      <TableCell className="text-right font-bold text-red-700">{formatMoney(row.totalAmount)}</TableCell>
                      <TableCell className="w-36 text-right">
                        <div className="ml-auto w-28">
                          <Input
                            className={`bg-amber-50 px-2 py-1 text-right text-xs font-bold ${fieldError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                            disabled={row.approvalStatus !== 'pending'}
                            inputMode="decimal"
                            type="text"
                            value={inputDrafts[row.id] ?? formatDecimalWithGrouping(currentPayAmount(row))}
                            onBlur={() => handlePayAmountBlur(row)}
                            onChange={(event) => handlePayAmountChange(row, event.target.value)}
                            onFocus={() => handlePayAmountFocus(row)}
                          />
                          {fieldError ? <div className="mt-1 text-right text-[11px] text-red-600">{fieldError}</div> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        <span className={`inline-flex items-center gap-1 ${row.approvalStatus === 'approved' ? 'text-emerald-700' : 'text-slate-500'}`}>
                          <span className={`h-2 w-2 rounded-full ${row.approvalStatus === 'approved' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          {row.approvalStatus === 'approved' ? 'อนุมัติแล้ว' : 'ยังไม่อนุมัติ'}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {!isLoading && totalRows === 0 ? <TableRow><TableCell className="p-6 text-center text-slate-500" colSpan={9}>ไม่มีค่าใช้จ่ายค้างจ่าย</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </section>
  )
}

function approvalSortValue(
  row: ApprovalPayload['apRows'][number] | ApprovalPayload['expenseRows'][number],
  sortKey: ApprovalSortKey,
  currentBankLabel: (row: ApprovalApRow) => string,
) {
  switch (sortKey) {
    case 'docNo':
      return row.docNo ?? ''
    case 'date':
      return row.date ?? ''
    case 'partyName':
      return 'supplierName' in row ? row.supplierName ?? '' : row.payee ?? ''
    case 'bankAccount':
      return 'bankAccount' in row ? currentBankLabel(row) : row.accountName ?? ''
    case 'totalAmount':
      return row.totalAmount ?? 0
    case 'paidAmount':
      return 'paidAmount' in row ? row.paidAmount ?? 0 : 0
    case 'payableBalance':
      return 'payableBalance' in row ? row.payableBalance ?? 0 : row.totalAmount ?? 0
    case 'dueDate':
      return 'dueDate' in row ? row.dueDate ?? '' : row.date ?? ''
    default:
      return ''
  }
}

function SortableHead({ align, currentKey, direction, label, onSort, sortKey }: { align: 'left' | 'right'; currentKey: ApprovalSortKey; direction: ApprovalSortDirection; label: string; onSort: (key: ApprovalSortKey) => void; sortKey: ApprovalSortKey }) {
  const active = currentKey === sortKey
  const alignClass = align === 'right' ? 'justify-end text-right' : 'justify-start text-left'
  return (
    <TableHead className={align === 'right' ? 'text-right' : undefined}>
      <button className={`inline-flex w-full items-center gap-1 rounded-md px-1 py-0.5 hover:bg-slate-200 ${alignClass}`} type="button" onClick={() => onSort(sortKey)}>
        <span>{label}</span>
        <span className="text-xs text-slate-400">{active ? (direction === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    </TableHead>
  )
}
