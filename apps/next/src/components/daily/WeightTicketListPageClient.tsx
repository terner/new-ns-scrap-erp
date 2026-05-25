'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Plus, Printer, Search, Share2, SquarePen, XCircle } from 'lucide-react'
import { getErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DatePickerInput } from '@/components/ui/date-picker-input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { openWeightTicketReceiptPrint } from '@/lib/weight-ticket-print'
import { openWeightTicketLineShare } from '@/lib/weight-ticket-share'
import { cn } from '@/lib/utils'
import {
  cancelWeightTicket,
  formatWeight,
  listWeightTickets,
  statusLabels,
  type OptionItem,
  type WeightTicketRecord,
  type WeightTicketStatus,
  type WeightTicketSortBy,
  type WeightTicketSortDir,
  type WeightTicketType,
  typeLabels,
} from '@/lib/weight-tickets'

type TypeFilter = 'all' | WeightTicketType
type StatusFilter = 'all' | WeightTicketStatus

const pageSize = 10

const statusOptions: { label: string; value: StatusFilter }[] = [
  { label: 'ทุกสถานะ', value: 'all' },
  { label: statusLabels.received, value: 'received' },
  { label: statusLabels.delivered, value: 'delivered' },
  { label: statusLabels.partially_billed, value: 'partially_billed' },
  { label: statusLabels.billed, value: 'billed' },
  { label: statusLabels.cancelled, value: 'cancelled' },
]

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('th-TH', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function SortHeader({
  active,
  direction,
  label,
  onClick,
}: {
  active: boolean
  direction: WeightTicketSortDir
  label: string
  onClick: () => void
}) {
  return (
    <button className="inline-flex items-center gap-1 hover:text-slate-900" type="button" onClick={onClick}>
      <span>{label}</span>
      {active ? direction === 'desc' ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" /> : null}
    </button>
  )
}

export function WeightTicketListPageClient() {
  const router = useRouter()
  const [tickets, setTickets] = useState<WeightTicketRecord[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [branches, setBranches] = useState<OptionItem[]>([])
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortBy, setSortBy] = useState<WeightTicketSortBy>('createdAt')
  const [sortDir, setSortDir] = useState<WeightTicketSortDir>('desc')
  const [branchFilter, setBranchFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [cancelTicket, setCancelTicket] = useState<WeightTicketRecord | null>(null)
  const [cancelNote, setCancelNote] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [isCanceling, setIsCanceling] = useState(false)
  const [printingTicketId, setPrintingTicketId] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const safePage = Math.min(page, totalPages)
  const activeFilters = Boolean(query || typeFilter !== 'all' || statusFilter !== 'all' || branchFilter !== 'all' || dateFrom || dateTo)

  useEffect(() => {
    let cancelled = false

    async function loadBranches() {
      try {
        const response = await fetch('/api/branches', { cache: 'no-store' })
        if (!response.ok) return
        const data = await response.json() as { branches?: Array<{ code?: string | null; id: string; name: string }> }
        const nextBranches = (data.branches ?? []).map((branch) => ({
          code: branch.code ?? undefined,
          description: branch.code ? `รหัสสาขา ${branch.code}` : undefined,
          id: branch.id,
          label: branch.name,
        }))
        if (!cancelled) setBranches(nextBranches)
      } catch {
        if (!cancelled) setBranches([])
      }
    }

    void loadBranches()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadRows() {
      setIsLoading(true)
      setLoadError('')
      try {
        const result = await listWeightTickets({
          branchId: branchFilter,
          dateFrom,
          dateTo,
          page,
          pageSize,
          search: query.trim(),
          sortBy,
          sortDir,
          status: statusFilter,
          type: typeFilter,
        })
        if (cancelled) return
        setTickets(result.rows)
        setTotalRows(result.totalRows)
      } catch (caught) {
        if (cancelled) return
        setTickets([])
        setTotalRows(0)
        setLoadError(getErrorMessage(caught, 'โหลดรายการใบรับ-ส่งของไม่ได้'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadRows()
    return () => {
      cancelled = true
    }
  }, [branchFilter, dateFrom, dateTo, page, query, sortBy, sortDir, statusFilter, typeFilter])

  function clearFilters() {
    setQuery('')
    setTypeFilter('all')
    setStatusFilter('all')
    setSortBy('createdAt')
    setSortDir('desc')
    setBranchFilter('all')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  function toggleSort(nextSortBy: WeightTicketSortBy) {
    setPage(1)
    if (sortBy === nextSortBy) {
      setSortDir((current) => current === 'desc' ? 'asc' : 'desc')
      return
    }
    setSortBy(nextSortBy)
    setSortDir('desc')
  }

  async function handleCancelTicket() {
    if (!cancelTicket) return
    setIsCanceling(true)
    setCancelError('')
    try {
      const updated = await cancelWeightTicket(cancelTicket.id, cancelNote)
      setTickets((current) => current.map((ticket) => ticket.id === updated.id ? updated : ticket))
      setCancelTicket(null)
      setCancelNote('')
    } catch (caught) {
      setCancelError(getErrorMessage(caught, 'ยกเลิกใบรับ-ส่งของไม่ได้'))
    } finally {
      setIsCanceling(false)
    }
  }

  async function handlePrintTicket(ticket: WeightTicketRecord) {
    if (ticket.type !== 'WTI') return
    setPrintingTicketId(ticket.id)
    try {
      await openWeightTicketReceiptPrint(ticket)
    } catch (caught) {
      window.alert(getErrorMessage(caught, 'เปิดใบพิมพ์ใบรับสินค้าไม่สำเร็จ'))
    } finally {
      setPrintingTicketId(null)
    }
  }

  const summaryText = useMemo(() => `พบทั้งหมด ${totalRows.toLocaleString('th-TH')} รายการ`, [totalRows])

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/daily/weight-tickets">
            <Plus className="mr-2 size-4" />
            ชั่งสินค้า / รับ-ส่งของ
          </Link>
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(16rem,1fr)_10rem_10rem_12rem_11rem_11rem_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="ค้นหาเลขที่, ผู้ขาย/ลูกค้า, ทะเบียนรถ, สินค้า, สิ่งเจือปน"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(1)
              }}
            />
          </label>
          <Select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value as TypeFilter); setPage(1) }}>
            <option value="all">ทุกประเภท</option>
            <option value="WTI">ใบรับของ WTI</option>
            <option value="WTO">ใบส่งของ WTO</option>
          </Select>
          <Select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as StatusFilter); setPage(1) }}>
            {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
          <Select value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value); setPage(1) }}>
            <option value="all">ทุกสาขา</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.label}</option>)}
          </Select>
          <DatePickerInput value={dateFrom} onChange={(value) => { setDateFrom(value); setPage(1) }} />
          <DatePickerInput value={dateTo} onChange={(value) => { setDateTo(value); setPage(1) }} />
          <Button disabled={!activeFilters} type="button" variant="secondary" onClick={clearFilters}>ล้างตัวกรอง</Button>
        </div>
      </Card>

      <div className="flex flex-col gap-3 px-1 py-1 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>{summaryText}</div>
        <div className="flex items-center gap-2">
          <Button disabled={safePage <= 1 || isLoading} size="xs" type="button" variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))}>ก่อนหน้า</Button>
          <span>หน้า {safePage} / {totalPages}</span>
          <Button disabled={safePage >= totalPages || isLoading} size="xs" type="button" variant="outline" onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>ถัดไป</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-xs font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-3 py-3 text-left">
                  <SortHeader active={sortBy === 'documentNo'} direction={sortDir} label="เลขที่" onClick={() => toggleSort('documentNo')} />
                </th>
                <th className="px-3 py-3 text-left">ประเภท</th>
                <th className="px-3 py-3 text-left">
                  <SortHeader active={sortBy === 'createdAt'} direction={sortDir} label="วันที่/เวลา" onClick={() => toggleSort('createdAt')} />
                </th>
                <th className="px-3 py-3 text-left">
                  <SortHeader active={sortBy === 'partyName'} direction={sortDir} label="ผู้ขาย/ลูกค้า" onClick={() => toggleSort('partyName')} />
                </th>
                <th className="px-3 py-3 text-left">สาขา</th>
                <th className="px-3 py-3 text-left">ทะเบียนรถ</th>
                <th className="px-3 py-3 text-right">
                  <SortHeader active={sortBy === 'netWeight'} direction={sortDir} label="น้ำหนักสุทธิ" onClick={() => toggleSort('netWeight')} />
                </th>
                <th className="px-3 py-3 text-left">สถานะ</th>
                <th className="px-3 py-3 text-left">อัปเดตล่าสุด</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td className="px-3 py-10 text-center text-slate-500" colSpan={10}>กำลังโหลดข้อมูล</td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td className="px-3 py-10 text-center text-red-600" colSpan={10}>{loadError}</td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center text-slate-500" colSpan={10}>ยังไม่มีรายการตามเงื่อนไข</td>
                </tr>
              ) : tickets.map((ticket) => (
                <tr
                  className="cursor-pointer hover:bg-slate-50"
                  key={ticket.id}
                  onClick={() => router.push(`/daily/weight-ticket-list/${encodeURIComponent(ticket.documentNo)}`)}
                >
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-slate-900">{ticket.documentNo}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span className={cn('rounded-md px-2 py-1 text-xs font-semibold', ticket.type === 'WTI' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}>
                      {typeLabels[ticket.type]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDateTime(ticket.createdAt)}</td>
                  <td className="px-3 py-3 text-slate-900">{ticket.partyName}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{ticket.branchName}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{ticket.vehicleNo}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums text-slate-900">{formatWeight(ticket.totals.netWeight)} กก.</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span className={cn(
                      'rounded-md px-2 py-1 text-xs font-medium',
                      ticket.status === 'cancelled'
                        ? 'bg-rose-100 text-rose-700'
                        : ticket.status === 'billed'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-700',
                    )}
                    >
                      {statusLabels[ticket.status]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    <div className="truncate">{ticket.updatedBy}</div>
                    <div className="font-mono text-[11px] text-slate-400">{formatDateTime(ticket.updatedAt || ticket.createdAt)}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {ticket.type === 'WTI' ? (
                        <Button
                          size="xs"
                          type="button"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation()
                            void handlePrintTicket(ticket)
                          }}
                        >
                          <Printer className="mr-1 size-3" />
                          {printingTicketId === ticket.id ? 'กำลังเตรียม...' : 'พิมพ์'}
                        </Button>
                      ) : null}
                      <Button
                        size="xs"
                        type="button"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation()
                          openWeightTicketLineShare(ticket)
                        }}
                      >
                        <Share2 className="mr-1 size-3" />
                        แชร์
                      </Button>
                      {ticket.canEdit ? (
                        <Button asChild size="xs" type="button" variant="outline">
                          <Link
                            href={`/daily/weight-tickets?id=${encodeURIComponent(ticket.id)}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <SquarePen className="mr-1 size-3" />
                            แก้ไข
                          </Link>
                        </Button>
                      ) : null}
                      {ticket.canCancel ? (
                        <Button
                          size="xs"
                          type="button"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation()
                            setCancelTicket(ticket)
                            setCancelError('')
                            setCancelNote(ticket.cancelNote ?? '')
                          }}
                        >
                          <XCircle className="mr-1 size-3" />
                          ยกเลิก
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={Boolean(cancelTicket)} onOpenChange={(open) => {
        if (!open) {
          setCancelTicket(null)
          setCancelNote('')
          setCancelError('')
        }
      }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>ยกเลิกใบรับ-ส่งของ</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {cancelTicket?.documentNo}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                เหตุผลการยกเลิก<span className="ml-1 text-red-600">*</span>
              </label>
              <Input placeholder="ระบุเหตุผลการยกเลิก" value={cancelNote} onChange={(event) => setCancelNote(event.target.value)} />
              {cancelError ? <div className="mt-1 text-xs text-red-600">{cancelError}</div> : null}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="secondary" onClick={() => setCancelTicket(null)}>ปิด</Button>
            <Button disabled={isCanceling} type="button" variant="outline" onClick={handleCancelTicket}>
              <XCircle className="mr-2 size-4" />
              {isCanceling ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
