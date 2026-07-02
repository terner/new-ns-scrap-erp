'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { DatePickerInput } from '@/components/ui/date-picker-input'
import { Input } from '@/components/ui/Input'
import { ResizableTableHead } from '@/components/ui/ResizableTableHead'
import { Select } from '@/components/ui/Select'
import { SearchCombobox } from '@/components/ui/SearchCombobox'
import type { SearchComboboxOption } from '@/components/ui/SearchCombobox'
import { useResizableColumns, type ResizableColumnDefinition } from '@/components/ui/useResizableColumns'
import { dailyFetchJson, formatMoney } from '@/lib/daily'
import { formatDateDisplay } from '@/lib/format'
import {
  DualCostingErrorBox,
  DualCostingFilterCard,
  DualCostingHint,
  DualCostingPageSection,
  DualCostingStatCard,
  DualCostingWorkflowStrip,
} from './DualCostingPageShell'

type CostPoolRow = {
  availableQty: number
  availableValue: number
  branchName: string
  costPoolId: string
  costType: string
  counterparty: string
  date: string
  productId: string
  productName: string
  qty: number
  sourceNo: string
  sourceType: string
  status: string
  totalCost: number
  unitCost: number
  usedQty: number
}

type CostPoolPayload = {
  filters: {
    costTypes: string[]
    products: Array<{ id: string; name: string }>
    sourceTypes: string[]
    statuses: string[]
  }
  rows: CostPoolRow[]
  summary: {
    availableQty: number
    availableValue: number
    originalQty: number
    originalValue: number
    rows: number
    usedQty: number
  }
  summaryByCostType: Array<{ availableQty: number; availableValue: number; count: number; costType: string }>
}

type CostPoolColumnKey = 'availableQty' | 'availableValue' | 'branchName' | 'costType' | 'counterparty' | 'date' | 'productName' | 'qty' | 'sourceNo' | 'sourceType' | 'status' | 'unitCost' | 'usedQty'
type SortDirection = 'asc' | 'desc'

const costPoolColumns: Array<ResizableColumnDefinition<CostPoolColumnKey>> = [
  { key: 'costType', defaultWidth: 125, minWidth: 105 },
  { key: 'sourceType', defaultWidth: 125, minWidth: 105 },
  { key: 'sourceNo', defaultWidth: 150, minWidth: 125 },
  { key: 'date', defaultWidth: 115, minWidth: 100 },
  { key: 'branchName', defaultWidth: 130, minWidth: 105 },
  { key: 'counterparty', defaultWidth: 210, minWidth: 150 },
  { key: 'productName', defaultWidth: 220, minWidth: 160 },
  { key: 'qty', defaultWidth: 135, minWidth: 110 },
  { key: 'usedQty', defaultWidth: 130, minWidth: 105 },
  { key: 'availableQty', defaultWidth: 145, minWidth: 120 },
  { key: 'unitCost', defaultWidth: 130, minWidth: 105 },
  { key: 'availableValue', defaultWidth: 155, minWidth: 130 },
  { key: 'status', defaultWidth: 140, minWidth: 115 },
]

export function CostPoolPageClient() {
  const [availableOnly, setAvailableOnly] = useState(true)
  const [costType, setCostType] = useState('all')
  const [data, setData] = useState<CostPoolPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [productId, setProductId] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('FIFO')
  const [sourceType, setSourceType] = useState('all')
  const [status, setStatus] = useState('all')
  const [toDate, setToDate] = useState('')
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sortKey, setSortKey] = useState<CostPoolColumnKey | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const columnResize = useResizableColumns('dual-costing.cost-pool.main.v1', costPoolColumns)

  useEffect(() => {
    setPage(1)
  }, [availableOnly, costType, fromDate, productId, search, sort, sourceType, status, toDate])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('availableOnly', String(availableOnly))
    if (costType !== 'all') params.set('costType', costType)
    if (fromDate) params.set('from', fromDate)
    if (productId) params.set('productId', productId)
    if (search.trim()) params.set('q', search.trim())
    if (sort !== 'FIFO') params.set('sort', sort)
    if (sourceType !== 'all') params.set('sourceType', sourceType)
    if (status !== 'all') params.set('status', status)
    if (toDate) params.set('to', toDate)
    return params.toString()
  }, [availableOnly, costType, fromDate, productId, search, sort, sourceType, status, toDate])

  const loadData = useCallback(async () => {
    setError(null)
    setIsLoading(true)
    try {
      setData(await dailyFetchJson<CostPoolPayload>(`/api/dual-costing/cost-pool?${queryString}`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'โหลด Cost Pool ไม่ได้')
    } finally {
      setIsLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rows = useMemo(() => data?.rows ?? [], [data?.rows])
  const sortedRows = useMemo(() => {
    if (!sortKey) return rows

    return [...rows].sort((a, b) => {
      const aValue = getCostPoolSortValue(a, sortKey)
      const bValue = getCostPoolSortValue(b, sortKey)
      const result = typeof aValue === 'number' && typeof bValue === 'number'
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue), 'th', { numeric: true })

      return sortDirection === 'asc' ? result : -result
    })
  }, [rows, sortDirection, sortKey])
  const totalRows = sortedRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, currentPage, pageSize])

  const productSearchOptions = useMemo<SearchComboboxOption[]>(() => {
    return (data?.filters.products ?? []).map((product) => ({
      id: product.id,
      label: product.name,
      searchText: product.name.toLowerCase(),
    }))
  }, [data?.filters.products])

  const exportHref = `/api/dual-costing/cost-pool?${queryString ? `${queryString}&` : ''}format=xlsx`
  const hasActiveFilters = Boolean(search || fromDate || toDate || productId !== '' || costType !== 'all' || sourceType !== 'all' || status !== 'all' || !availableOnly || sort !== 'FIFO')
  const activeFilterCount = [
    fromDate,
    toDate,
    productId,
    costType !== 'all',
    sourceType !== 'all',
    status !== 'all',
    !availableOnly,
    sort !== 'FIFO',
  ].filter(Boolean).length

  function resetFilters() {
    setAvailableOnly(true)
    setCostType('all')
    setFromDate('')
    setProductId('')
    setSearch('')
    setSort('FIFO')
    setSourceType('all')
    setStatus('all')
    setToDate('')
  }

  function handleSort(key: CostPoolColumnKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(key)
    setSortDirection('asc')
  }

  const tableControls = (
    <>
      <div>
        พบทั้งหมด <span className="font-semibold text-slate-900">{totalRows}</span> รายการ
        <span className="ml-2 text-xs font-normal text-slate-500">เรียงตาม {sort}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {columnResize.hasCustomWidths ? (
          <Button className="hidden h-9 md:inline-flex" size="sm" type="button" variant="outline" onClick={columnResize.resetColumnWidths}>
            คืนค่าเดิมตาราง
          </Button>
        ) : null}
        <select
          aria-label="จำนวนรายการต่อหน้า"
          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800"
          value={pageSize}
          onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }}
        >
          {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} / หน้า</option>)}
        </select>
        <Button
          disabled={currentPage <= 1}
          className="h-9"
          size="sm"
          variant="outline"
          type="button"
          onClick={() => setPage((value) => Math.max(1, value - 1))}
        >
          ก่อนหน้า
        </Button>
        <span className="px-1">หน้า {currentPage} / {totalPages}</span>
        <Button
          disabled={currentPage >= totalPages}
          className="h-9"
          size="sm"
          variant="outline"
          type="button"
          onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
        >
          ถัดไป
        </Button>
      </div>
    </>
  )

  return (
    <DualCostingPageSection>
      <DualCostingHint tone="amber">
        <strong>Cost Pool</strong> คือต้นทุนคงเหลือที่รอ match กับดีลขายทองแดง/ทองเหลือง ไม่ใช่ stock จริง และยังต้องแยกจาก WAC ที่ใช้ลง P/L ตามหลักบัญชี
      </DualCostingHint>

      <DualCostingErrorBox error={error} />
      <DualCostingWorkflowStrip active="pool" />

      <div className="grid gap-3 md:grid-cols-3">
        {costTypeCards.map((card) => {
          const row = data?.summaryByCostType.find((item) => item.costType === card.costType)
          return (
            <CostTypeCard
              key={card.costType}
              availableQty={row?.availableQty ?? 0}
              availableValue={row?.availableValue ?? 0}
              count={row?.count ?? 0}
              {...card}
            />
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <DualCostingStatCard icon="⚖️" label="ปริมาณต้นทุนตั้งต้น" tone="slate" value={formatMoney(data?.summary.originalQty ?? 0)} />
        <DualCostingStatCard icon="🔗" label="ปริมาณที่จับคู่แล้ว" tone="amber" value={formatMoney(data?.summary.usedQty ?? 0)} />
        <DualCostingStatCard icon="✅" label="ปริมาณคงเหลือ" tone="emerald" value={formatMoney(data?.summary.availableQty ?? 0)} />
        <DualCostingStatCard icon="💰" label="มูลค่าต้นทุนรวม" tone="slate" value={formatMoney(data?.summary.originalValue ?? 0)} />
        <DualCostingStatCard icon="📈" label="มูลค่าคงเหลือ" tone="emerald" value={formatMoney(data?.summary.availableValue ?? 0)} />
      </div>

      <DualCostingFilterCard>
        {/* Desktop View */}
        <div className="hidden xl:block space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="min-w-[200px] flex-1 rounded-md border-slate-300 focus-visible:ring-emerald-100"
              placeholder="ค้นหาเลขที่ / คู่ค้า / สินค้า..."
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <span className="text-xs font-semibold text-slate-500">วันที่เอกสาร:</span>
            <DatePickerInput id="cost-pool-date-from" value={fromDate} onChange={setFromDate} />
            <span className="text-slate-400">→</span>
            <DatePickerInput id="cost-pool-date-to" value={toDate} onChange={setToDate} />
            <div className="w-auto min-w-[180px]">
              <SearchCombobox
                hideLabel
                inputClassName="h-9 text-sm focus-visible:ring-emerald-100 border-slate-300"
                inputId="cost-pool-product-filter"
                label="สินค้า"
                options={productSearchOptions}
                placeholder="ทุกสินค้า"
                value={productId}
                onChange={(value) => setProductId(value || '')}
              />
            </div>
            <Select aria-label="ประเภทต้นทุน" className="h-9 w-auto min-w-[150px] border-slate-300 focus-visible:ring-emerald-100" value={costType} onChange={(event) => setCostType(event.target.value)}>
              <option value="all">ทุกประเภทต้นทุน</option>
              {(data?.filters.costTypes ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Select aria-label="แหล่งต้นทุน" className="h-9 w-auto min-w-[140px] border-slate-300 focus-visible:ring-emerald-100" value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
              <option value="all">ทุกแหล่งต้นทุน</option>
              {(data?.filters.sourceTypes ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Select aria-label="สถานะ" className="h-9 w-auto min-w-[130px] border-slate-300 focus-visible:ring-emerald-100" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">ทุกสถานะ</option>
              {(data?.filters.statuses ?? []).map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
            </Select>
            <Select aria-label="เรียงลำดับ" className="h-9 w-auto min-w-[135px] border-slate-300 focus-visible:ring-emerald-100" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="FIFO">FIFO</option>
              <option value="LIFO">LIFO</option>
              <option value="Cheap">ต้นทุนถูกก่อน</option>
              <option value="Expensive">ต้นทุนแพงก่อน</option>
            </Select>
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm text-emerald-700 select-none">
              <input checked={availableOnly} className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 border-emerald-300" type="checkbox" onChange={(event) => setAvailableOnly(event.target.checked)} />
              คงเหลือพร้อมใช้
            </label>
            {hasActiveFilters ? <Button className="h-9" size="sm" type="button" variant="secondary" onClick={resetFilters}>ล้างตัวกรอง</Button> : null}
            <Button asChild className="ml-auto focus-visible:ring-2 focus-visible:ring-emerald-100" size="sm" variant="export">
              <a href={exportHref}>ส่งออก XLSX</a>
            </Button>
          </div>
        </div>

        {/* Mobile / Tablet Collapsible View */}
        <div className="block xl:hidden space-y-2">
          <div className="flex gap-2">
            <Input
              className="flex-1 h-10 rounded-md border-slate-300 focus-visible:ring-emerald-100"
              placeholder="ค้นหาเลขที่ / คู่ค้า / สินค้า..."
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              className={`h-10 rounded-md border px-3 text-sm font-semibold transition-colors flex items-center gap-1 shrink-0 ${
                showMobileFilters ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-700 border-slate-100'
              }`}
              type="button"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
            >
              ตัวกรอง{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
            <Button asChild size="sm" variant="export" className="h-10 shrink-0">
              <a href={exportHref}>XLSX</a>
            </Button>
          </div>

          {showMobileFilters && (
            <div className="grid grid-cols-1 gap-2.5 pt-2 border-t border-slate-100 animate-in slide-in-from-top-2 duration-100">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-500 font-semibold">
                  จากวันที่
                  <DatePickerInput className="mt-1 w-full" value={fromDate} onChange={setFromDate} />
                </label>
                <label className="text-xs text-slate-500 font-semibold">
                  ถึงวันที่
                  <DatePickerInput className="mt-1 w-full" value={toDate} onChange={setToDate} />
                </label>
              </div>
              <label className="text-xs text-slate-500 font-semibold">
                เลือกสินค้า
                <SearchCombobox
                  hideLabel
                  inputClassName="h-9 text-sm w-full border-slate-300 mt-1"
                  inputId="cost-pool-product-filter-mobile"
                  label="สินค้า"
                  options={productSearchOptions}
                  placeholder="ทุกสินค้า"
                  value={productId}
                  onChange={(value) => setProductId(value || '')}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-500 font-semibold">
                  ประเภทต้นทุน
                  <Select aria-label="ประเภทต้นทุน" className="mt-1 h-9 w-full border-slate-300" value={costType} onChange={(event) => setCostType(event.target.value)}>
                    <option value="all">ทุกประเภทต้นทุน</option>
                    {(data?.filters.costTypes ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </label>
                <label className="text-xs text-slate-500 font-semibold">
                  แหล่งต้นทุน
                  <Select aria-label="แหล่งต้นทุน" className="mt-1 h-9 w-full border-slate-300" value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
                    <option value="all">ทุกแหล่งต้นทุน</option>
                    {(data?.filters.sourceTypes ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-500 font-semibold">
                  สถานะ
                  <Select aria-label="สถานะ" className="mt-1 w-full h-9 border-slate-300" value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="all">ทุกสถานะ</option>
                    {(data?.filters.statuses ?? []).map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
                  </Select>
                </label>
                <label className="text-xs text-slate-500 font-semibold">
                  เรียงลำดับ
                  <Select aria-label="เรียงลำดับ" className="mt-1 w-full h-9 border-slate-300" value={sort} onChange={(event) => setSort(event.target.value)}>
                    <option value="FIFO">FIFO</option>
                    <option value="LIFO">LIFO</option>
                    <option value="Cheap">ต้นทุนถูกก่อน</option>
                    <option value="Expensive">ต้นทุนแพงก่อน</option>
                  </Select>
                </label>
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 select-none">
                  <input checked={availableOnly} className="h-3.5 w-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-emerald-300" type="checkbox" onChange={(event) => setAvailableOnly(event.target.checked)} />
                  เฉพาะคงเหลือพร้อมใช้
                </label>
                {hasActiveFilters ? <button className="rounded-md bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200" type="button" onClick={resetFilters}>ล้างตัวกรอง</button> : null}
              </div>
            </div>
          )}
        </div>
      </DualCostingFilterCard>

      <div className="mb-3 flex flex-col gap-3 px-1 py-1 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between md:hidden">
        {tableControls}
      </div>

      <div className="hidden overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm md:block">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-3 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          {tableControls}
        </div>
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm" style={{ tableLayout: 'fixed', minWidth: columnResize.tableMinWidth, width: '100%' }}>
          <colgroup>
            {costPoolColumns.map((column, index) => {
              const style = columnResize.getColumnStyle(column.key)
              if (index === costPoolColumns.length - 1) {
                return <col key={column.key} style={{ minWidth: column.minWidth }} />
              }
              return <col key={column.key} style={style} />
            })}
          </colgroup>
          <thead className="bg-slate-100">
            <tr>
              <ResizableTableHead label="ประเภทต้นทุน" activeSortKey={sortKey ?? undefined} direction={sortDirection} sortKey="costType" onSort={handleSort} resizeProps={columnResize.getResizeHandleProps('costType', 'ประเภทต้นทุน')} />
              <ResizableTableHead label="แหล่งต้นทุน" activeSortKey={sortKey ?? undefined} direction={sortDirection} sortKey="sourceType" onSort={handleSort} resizeProps={columnResize.getResizeHandleProps('sourceType', 'แหล่งต้นทุน')} />
              <ResizableTableHead label="เลขที่เอกสารต้นทุน" activeSortKey={sortKey ?? undefined} direction={sortDirection} sortKey="sourceNo" onSort={handleSort} resizeProps={columnResize.getResizeHandleProps('sourceNo', 'เลขที่เอกสารต้นทุน')} />
              <ResizableTableHead label="วันที่เอกสาร" activeSortKey={sortKey ?? undefined} direction={sortDirection} sortKey="date" onSort={handleSort} resizeProps={columnResize.getResizeHandleProps('date', 'วันที่เอกสาร')} />
              <ResizableTableHead label="สาขา" activeSortKey={sortKey ?? undefined} direction={sortDirection} sortKey="branchName" onSort={handleSort} resizeProps={columnResize.getResizeHandleProps('branchName', 'สาขา')} />
              <ResizableTableHead label="คู่ค้า" activeSortKey={sortKey ?? undefined} direction={sortDirection} sortKey="counterparty" onSort={handleSort} resizeProps={columnResize.getResizeHandleProps('counterparty', 'คู่ค้า')} />
              <ResizableTableHead label="สินค้า" activeSortKey={sortKey ?? undefined} direction={sortDirection} sortKey="productName" onSort={handleSort} resizeProps={columnResize.getResizeHandleProps('productName', 'สินค้า')} />
              <ResizableTableHead align="right" label="ปริมาณตั้งต้น" activeSortKey={sortKey ?? undefined} direction={sortDirection} sortKey="qty" onSort={handleSort} resizeProps={columnResize.getResizeHandleProps('qty', 'ปริมาณตั้งต้น')} />
              <ResizableTableHead align="right" label="จับคู่แล้ว" activeSortKey={sortKey ?? undefined} direction={sortDirection} sortKey="usedQty" onSort={handleSort} resizeProps={columnResize.getResizeHandleProps('usedQty', 'จับคู่แล้ว')} />
              <ResizableTableHead align="right" label="คงเหลือพร้อมใช้" activeSortKey={sortKey ?? undefined} direction={sortDirection} sortKey="availableQty" onSort={handleSort} resizeProps={columnResize.getResizeHandleProps('availableQty', 'คงเหลือพร้อมใช้')} />
              <ResizableTableHead align="right" label="ต้นทุน/หน่วย" activeSortKey={sortKey ?? undefined} direction={sortDirection} sortKey="unitCost" onSort={handleSort} resizeProps={columnResize.getResizeHandleProps('unitCost', 'ต้นทุนต่อหน่วย')} />
              <ResizableTableHead align="right" label="มูลค่าคงเหลือ" activeSortKey={sortKey ?? undefined} direction={sortDirection} sortKey="availableValue" onSort={handleSort} resizeProps={columnResize.getResizeHandleProps('availableValue', 'มูลค่าคงเหลือ')} />
              <ResizableTableHead align="center" label="สถานะ" activeSortKey={sortKey ?? undefined} direction={sortDirection} sortKey="status" onSort={handleSort} resizeProps={columnResize.getResizeHandleProps('status', 'สถานะ')} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? <tr><td className="px-3 py-10 text-center text-slate-500" colSpan={costPoolColumns.length}>กำลังโหลดข้อมูล</td></tr> : null}
            {!isLoading && !error && (data?.rows.length ?? 0) === 0 ? <tr><td className="px-3 py-10 text-center text-slate-400" colSpan={costPoolColumns.length}>Cost Pool ว่างตามตัวกรองปัจจุบัน</td></tr> : null}
            {!isLoading && pagedRows.map((row) => (
              <tr key={row.costPoolId} className="transition-colors hover:bg-slate-50">
                <td className="whitespace-nowrap px-3 py-3"><span className={`rounded border px-2 py-0.5 text-xs font-semibold ${costTypeBadgeClass(row.costType)}`}>{row.costType}</span></td>
                <td className="whitespace-nowrap px-3 py-3"><span className={`rounded border px-2 py-0.5 text-xs font-semibold ${sourceBadgeClass(row.sourceType)}`}>{row.sourceType}</span></td>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-slate-900">{row.sourceNo}</td>
                <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDateDisplay(row.date)}</td>
                <td className="px-3 py-3 text-slate-700">{row.branchName}</td>
                <td className="px-3 py-3 font-medium text-slate-900">{row.counterparty}</td>
                <td className="px-3 py-3 text-slate-700">{row.productName}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-slate-700">{formatMoney(row.qty)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-medium tabular-nums text-slate-700">{formatMoney(row.usedQty)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">{formatMoney(row.availableQty)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-slate-700">{formatMoney(row.unitCost)}</td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-semibold tabular-nums text-slate-900">{formatMoney(row.availableValue)}</td>
                <td className="px-3 py-3 text-center"><StatusIndicator status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {isLoading ? <div className="rounded-lg border border-slate-200 bg-white p-4 text-center text-sm text-slate-500 shadow-sm">กำลังโหลดข้อมูล</div> : null}
        {!isLoading && !error && (data?.rows.length ?? 0) === 0 ? <div className="rounded-lg border border-slate-200 bg-white p-4 text-center text-sm text-slate-400 shadow-sm">Cost Pool ว่างตามตัวกรองปัจจุบัน</div> : null}
        {!isLoading && pagedRows.map((row) => (
          <CostPoolMobileCard key={row.costPoolId} row={row} />
        ))}
      </div>

    </DualCostingPageSection>
  )
}

function getCostPoolSortValue(row: CostPoolRow, key: CostPoolColumnKey): string | number {
  if (key === 'date') {
    const timestamp = Date.parse(row.date)
    return Number.isNaN(timestamp) ? 0 : timestamp
  }

  if (key === 'status') {
    return statusLabel(row.status)
  }

  return row[key] ?? ''
}

function CostPoolMobileCard({ row }: { row: CostPoolRow }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${costTypeBadgeClass(row.costType)}`}>{row.costType}</span>
            <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${sourceBadgeClass(row.sourceType)}`}>{row.sourceType}</span>
          </div>
          <div className="mt-2 font-mono text-base font-bold text-slate-900">{row.sourceNo}</div>
          <div className="mt-0.5 text-xs text-slate-500">{formatDateDisplay(row.date)} · {row.branchName}</div>
        </div>
        <StatusIndicator status={row.status} />
      </div>

      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
        <div>
          <span className="font-semibold text-slate-500">คู่ค้า: </span>
          <span className="font-medium text-slate-900">{row.counterparty}</span>
        </div>
        <div className="mt-1">
          <span className="font-semibold text-slate-500">สินค้า: </span>
          <span className="text-slate-900">{row.productName}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
        <div>
          <span className="block text-xs text-slate-500">ปริมาณตั้งต้น</span>
          <span className="mt-0.5 block font-mono font-semibold tabular-nums text-slate-900">{formatMoney(row.qty)} กก.</span>
        </div>
        <div className="text-right">
          <span className="block text-xs text-slate-500">จับคู่แล้ว</span>
          <span className="mt-0.5 block font-mono font-semibold tabular-nums text-slate-700">{formatMoney(row.usedQty)} กก.</span>
        </div>
        <div>
          <span className="block text-xs text-slate-500">คงเหลือพร้อมใช้</span>
          <span className="mt-0.5 block font-mono font-bold tabular-nums text-slate-900">{formatMoney(row.availableQty)} กก.</span>
        </div>
        <div className="text-right">
          <span className="block text-xs text-slate-500">ต้นทุน/หน่วย</span>
          <span className="mt-0.5 block font-mono font-semibold tabular-nums text-slate-900">{formatMoney(row.unitCost)}</span>
        </div>
        <div className="col-span-2 text-right">
          <span className="block text-xs text-slate-500">มูลค่าคงเหลือ</span>
          <span className="mt-0.5 block font-mono font-bold tabular-nums text-slate-900">{formatMoney(row.availableValue)}</span>
        </div>
      </div>
    </div>
  )
}

const costTypeCards = [
  { costType: 'Purchase', label: 'ต้นทุนการจัดซื้อ (PO/Spot Buy)', tone: 'blue' },
  { costType: 'Production', label: 'ต้นทุนจากการผลิต', tone: 'orange' },
  { costType: 'Regrade', label: 'ต้นทุนปรับเกรด / แปรสภาพ', tone: 'purple' },
] as const

function CostTypeCard({
  availableQty,
  availableValue,
  count,
  costType,
  label,
  tone,
}: {
  availableQty: number
  availableValue: number
  count: number
  costType: string
  label: string
  tone: 'blue' | 'orange' | 'purple'
}) {
  const colors = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200/50',
    orange: 'bg-orange-100 text-orange-700 border-orange-200/50',
    purple: 'bg-purple-100 text-purple-700 border-purple-200/50',
  }[tone]

  const icons = {
    blue: '📥',
    orange: '🏭',
    purple: '🔄',
  }[tone]

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${colors.split(' ')[0]}`}>{icons}</div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-500">{label}</div>
        <div className="mt-0.5 text-lg font-bold font-mono text-slate-900 leading-tight">{formatMoney(availableQty)} กก.</div>
        <div className="text-xs text-slate-500 mt-0.5">
          <span className="font-mono font-semibold text-slate-700">{formatMoney(availableValue)}</span> ฿ · <span className="font-semibold text-slate-700">{count}</span> lots
        </div>
      </div>
    </div>
  )
}

function StatusIndicator({ status }: { status: string }) {
  const tones = status === 'Available'
    ? 'bg-emerald-500'
    : status === 'Partial'
      ? 'bg-amber-500'
      : 'bg-slate-400'

  return (
    <span className="inline-flex items-center gap-2 rounded-md px-2 py-0.5 text-xs text-slate-600 font-medium">
      <span className={`h-2 w-2 rounded-full ${tones}`} />
      {statusLabel(status)}
    </span>
  )
}

function statusLabel(status: string) {
  if (status === 'Available') return 'Available (พร้อม)'
  if (status === 'Partial') return 'Partial (Match บางส่วน)'
  if (status === 'Fully') return 'Fully (Match ครบแล้ว)'
  return status
}

function costTypeBadgeClass(type: string) {
  if (type === 'Production') return 'bg-orange-50 text-orange-700 border border-orange-200/50'
  if (type === 'Regrade') return 'bg-purple-50 text-purple-700 border border-purple-200/50'
  return 'bg-blue-50 text-blue-700 border border-blue-200/50'
}

function sourceBadgeClass(type: string) {
  if (type === 'Production') return 'bg-orange-50 text-orange-700 border border-orange-200/50'
  if (type === 'Regrade' || type === 'Grade Adjustment') return 'bg-purple-50 text-purple-700 border border-purple-200/50'
  if (type === 'PO_Buy') return 'bg-cyan-50 text-cyan-700 border border-cyan-200/50'
  return 'bg-blue-50 text-blue-700 border border-blue-200/50'
}
