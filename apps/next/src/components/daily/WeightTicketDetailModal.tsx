'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ClipboardList, Package2, Printer, Scale, SquarePen, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import { openWeightTicketPrintWindow, openWeightTicketReceiptPrint } from '@/lib/weight-ticket-print'
import { cn } from '@/lib/utils'
import { cancelWeightTicket, decodeStoredImageAsset, displayWeightTicketStatus, formatWeight, getWeightTicket, type WeightTicketRecord, type WeightTicketStatus, weightTicketStatusBadgeClass } from '@/lib/weight-tickets'
import { getErrorMessage } from '@/lib/api-client'

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

function timelineLabel(eventKey: string, action: string) {
  if (action === 'created') return 'สร้างเอกสาร'
  if (action === 'edited') return 'แก้ไขเอกสาร'
  if (action === 'cancelled') return 'ยกเลิกเอกสาร'
  if (action === 'status_synced') return 'ปรับสถานะปัจจุบัน'
  if (action === 'usage_status_changed') return 'เปลี่ยนสถานะจากการใช้งาน'
  if (action === 'allocated_to_purchase_bill') return 'นำไปออกบิลรับซื้อ'
  if (action === 'released_from_purchase_bill') return 'คืนยอดจากบิลรับซื้อ'
  if (eventKey.endsWith('.created')) return 'สร้างเอกสาร'
  if (eventKey.endsWith('.updated')) return 'แก้ไขเอกสาร'
  if (eventKey.endsWith('.cancelled')) return 'ยกเลิกเอกสาร'
  if (action === 'create') return 'สร้างเอกสาร'
  if (action === 'update') return 'แก้ไขเอกสาร'
  if (action === 'status') return 'เปลี่ยนสถานะเอกสาร'
  return eventKey
}

function timelineDotClass(action: string, isLatest: boolean) {
  if (!isLatest) return 'bg-slate-300'
  if (action === 'cancelled' || action === 'released_from_purchase_bill') return 'bg-rose-500'
  if (action === 'edited' || action === 'usage_status_changed' || action === 'status_synced') return 'bg-amber-500'
  if (action === 'allocated_to_purchase_bill') return 'bg-blue-500'
  return 'bg-emerald-500'
}

function metadataString(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' ? value : ''
}

function metadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function timelineStatusLabel(type: WeightTicketRecord['type'], status: string) {
  if (!status) return ''
  return displayWeightTicketStatus(type, status as WeightTicketStatus)
}

function usageActionLabel(action: string) {
  if (action === 'allocated_to_purchase_bill') return 'นำไปออกบิลรับซื้อ'
  if (action === 'released_from_purchase_bill') return 'คืนยอดจากบิลรับซื้อ'
  return action || '-'
}

function usageWeightLabel(action: string, weight: number) {
  const sign = action === 'released_from_purchase_bill' ? '+' : '-'
  return `${sign} ${formatWeight(weight)} กก.`
}

function usageWeightClass(action: string) {
  if (action === 'released_from_purchase_bill') return 'text-emerald-700'
  return 'text-rose-700'
}

function AccordionSection({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
        onClick={onToggle}
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            'size-4 text-slate-500 transition-transform duration-200',
            isOpen ? 'rotate-180' : ''
          )}
        />
      </button>
      {isOpen && (
        <div className="border-t border-slate-200 bg-white p-4">
          {children}
        </div>
      )}
    </div>
  )
}

export function WeightTicketDetailModal({ ticketId, onClose }: { ticketId: string; onClose: () => void }) {
  const [ticket, setTicket] = useState<WeightTicketRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [cancelNote, setCancelNote] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [isCanceling, setIsCanceling] = useState(false)
  const [previewImage, setPreviewImage] = useState<{ fileName: string; url: string } | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)
  const [lineGallery, setLineGallery] = useState<{
    activeIndex: number
    images: Array<{ fileName: string; url: string }>
    title: string
  } | null>(null)

  // Responsive state variables
  const [expandedSections, setExpandedSections] = useState({
    partyInfo: true,
    lines: true,
    summaries: false,
    usage: false,
    timeline: false,
  })
  const [selectedLineDetail, setSelectedLineDetail] = useState<WeightTicketRecord['lines'][number] | null>(null)
  const [isDocInfoExpanded, setIsDocInfoExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadTicket() {
      setIsLoading(true)
      setLoadError('')
      try {
        const nextTicket = await getWeightTicket(ticketId)
        if (cancelled) return
        setTicket(nextTicket)
        setCancelNote(nextTicket.cancelNote ?? '')
      } catch (caught) {
        if (!cancelled) setLoadError(getErrorMessage(caught, 'โหลดใบรับ-ส่งของไม่ได้'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadTicket()
    return () => {
      cancelled = true
    }
  }, [ticketId])

  const vehicleImages = useMemo(
    () => (ticket?.vehicleImageNames ?? []).map(decodeStoredImageAsset),
    [ticket],
  )

  async function handleCancelTicket() {
    if (!ticket) return
    setIsCanceling(true)
    setCancelError('')
    try {
      const updated = await cancelWeightTicket(ticket.id, cancelNote)
      setTicket(updated)
    } catch (caught) {
      setCancelError(getErrorMessage(caught, 'ยกเลิกใบรับ-ส่งของไม่ได้'))
    } finally {
      setIsCanceling(false)
    }
  }

  async function handlePrintReceipt() {
    if (!ticket) return
    setIsPrinting(true)
    let printWindow: Window | null = null
    try {
      printWindow = openWeightTicketPrintWindow(ticket)
      await openWeightTicketReceiptPrint(ticket, printWindow)
    } catch (caught) {
      printWindow?.close()
      window.alert(getErrorMessage(caught, 'เปิดใบพิมพ์ใบรับ-ส่งสินค้าไม่สำเร็จ'))
    } finally {
      setIsPrinting(false)
    }
  }

  const activeGalleryImage = lineGallery?.images[lineGallery.activeIndex] ?? null

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) onClose()
    }}>
      <DialogContent aria-labelledby="weight-ticket-detail-title" className="h-screen md:h-auto max-h-screen md:max-h-[90vh] w-full max-w-6xl flex flex-col overflow-hidden rounded-none md:rounded-md p-0" hideClose>
        <DialogHeader className="shrink-0 border-b border-slate-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                className="lg:hidden rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 shrink-0"
                onClick={onClose}
              >
                <ChevronLeft className="size-5" />
              </button>
              <div className="min-w-0">
                <DialogTitle id="weight-ticket-detail-title" className="text-sm sm:text-base md:text-lg font-bold text-slate-900 truncate">
                  {ticket?.type === 'WTI' ? 'ใบรับของ' : ticket?.type === 'WTO' ? 'ใบส่งของ' : 'รายละเอียดเอกสาร'} {ticket?.documentNo ?? ticketId}
                </DialogTitle>
                <DialogDescription className="truncate text-xs sm:text-sm">
                  {ticket?.partyName ?? (isLoading ? 'กำลังโหลดข้อมูล' : '-')}
                </DialogDescription>
              </div>
            </div>
            {ticket ? (
              <div className="flex gap-1.5 sm:gap-2">
                <Button
                  className="font-normal px-2.5 sm:px-3 gap-1.5 text-xs sm:text-sm h-8 sm:h-9"
                  disabled={isPrinting}
                  type="button"
                  variant="outline"
                  onClick={() => void handlePrintReceipt()}
                >
                  <Printer className="size-3.5 sm:size-4" />
                  <span className="hidden sm:inline">
                    {isPrinting ? 'กำลังเตรียม...' : ticket.type === 'WTI' ? 'พิมพ์ใบรับสินค้า' : 'พิมพ์ใบส่งของ'}
                  </span>
                  <span className="inline sm:hidden">
                    {isPrinting ? '...' : 'พิมพ์'}
                  </span>
                </Button>
                {ticket.canEdit ? (
                  <Button asChild type="button" variant="outline" className="font-normal px-2.5 sm:px-3 gap-1.5 text-xs sm:text-sm h-8 sm:h-9">
                    <Link href={`/daily/weight-tickets?id=${encodeURIComponent(ticket.id)}`}>
                      <SquarePen className="size-3.5 sm:size-4" />
                      <span>แก้ไข</span>
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-slate-50/30 p-4 sm:p-5">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-slate-500">กำลังโหลดข้อมูล...</div>
          ) : loadError || !ticket ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{loadError || 'ไม่พบใบรับ-ส่งของ'}</div>
          ) : (
            <>
              {/* ========================================================================= */}
              {/* DESKTOP LAYOUT (แสดงตาราง/รายละเอียดแบบเดิม 100%) */}
              {/* ========================================================================= */}
              <div className="hidden lg:block space-y-5">
                <div className="space-y-4">
                  <Card className="p-5">
                    <SectionTitle subtitle="ข้อมูลเอกสารและผู้ใช้งาน" title="ข้อมูลเอกสาร" />
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <DetailItem
                        label={ticket.type === 'WTI' ? 'ใบรับของ' : 'ใบส่งของ'}
                        value={ticket.documentNo}
                      />
                      <DetailItem label="วันที่/เวลาสร้าง" value={formatDateTime(ticket.createdAt)} />
                      <DetailItem label="ผู้กรอก" value={ticket.enteredBy} />
                      <DetailItem label="อัปเดตล่าสุด" value={formatDateTime(ticket.updatedAt || ticket.createdAt)} />
                      <DetailItem label="ผู้แก้ไขล่าสุด" value={ticket.updatedBy} />
                      {ticket.type === 'WTI' ? (
                        <DetailItem label="อ้างอิงบิลซื้อ" value={`${ticket.usedInPurchaseBillCount} รายการ`} />
                      ) : (
                        <DetailItem label="อ้างอิงบิลขาย" value={`${ticket.usedInSalesBillCount} รายการ`} />
                      )}
                    </div>
                    {ticket.type === 'WTI' && ticket.usedInPurchaseBillDocNos.length > 0 ? (
                      <div className="mt-4 rounded-md bg-slate-50 px-4 py-3">
                        <div className="text-xs font-medium text-slate-500">เลขที่บิลซื้อที่อ้างอิง</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {ticket.usedInPurchaseBillDocNos.map((docNo) => (
                            <span className="rounded-md bg-white px-2.5 py-1 text-xs text-slate-700 shadow-sm" key={docNo}>
                              {docNo}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {ticket.remark ? (
                      <div className="mt-4 rounded-md bg-slate-50 px-4 py-3">
                        <div className="text-xs font-medium text-slate-500">
                          {ticket.type === 'WTI' ? 'หมายเหตุใบรับของ' : 'หมายเหตุใบส่งของ'}
                        </div>
                        <div className="mt-1 text-sm text-slate-600">{ticket.remark}</div>
                      </div>
                    ) : null}
                    {ticket.status === 'cancelled' && ticket.cancelNote ? (
                      <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        เหตุผลการยกเลิก: {ticket.cancelNote}
                      </div>
                    ) : null}
                    {!ticket.canEdit || !ticket.canCancel ? (
                      <div className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        เอกสารถูกนำไปใช้กับบิลรับซื้อหรือบิลขายแล้ว จึงไม่สามารถแก้ไขหรือยกเลิกได้
                      </div>
                    ) : null}
                  </Card>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <MetricCard icon={<ClipboardList className="size-4" />} label="สาขา" value={ticket.branchName} />
                    <MetricCard icon={<Scale className="size-4" />} label="น้ำหนักสุทธิ" value={`${formatWeight(ticket.totals.netWeight)} กก.`} />
                    <MetricCard
                      icon={<Package2 className="size-4" />}
                      label="สินค้าหลังรวม"
                      value={`${ticket.productSummaries.length} สินค้า / ${ticket.lines.length} lot`}
                    />
                  </div>

                  <Card className="p-5">
                    <SectionTitle subtitle="ข้อมูลคู่ค้าและรถที่ใช้ส่งสินค้า" title={ticket.type === 'WTI' ? 'ข้อมูลผู้ขาย' : 'ข้อมูลลูกค้า'} />
                    <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
                      <div className="grid gap-4 md:grid-cols-2">
                        <DetailItem label={ticket.type === 'WTI' ? 'ผู้ขาย' : 'ลูกค้า'} value={ticket.partyName} />
                        <DetailItem label="ทะเบียนรถ" value={ticket.vehicleNo} />
                      </div>
                      <div>
                        <div className="mb-2 text-xs text-slate-500">รูปภาพรถส่งของ</div>
                        <ImageGrid images={vehicleImages} onOpen={(image) => setPreviewImage(image)} />
                      </div>
                    </div>
                  </Card>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
                    <div className="space-y-4">
                      <Card className="overflow-hidden p-0">
                        <div className="border-b border-slate-200 px-5 py-4">
                          <SectionTitle subtitle="รองรับเอกสารยาวหลายสิบรายการ" title="รายการสินค้าแยกตาม lot" />
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-200/80 border-b border-slate-300/80 text-xs font-semibold text-slate-600">
                              <tr>
                                <th className="px-3 py-3 text-left">ลำดับ</th>
                                <th className="px-3 py-3 text-left">สินค้า</th>
                                <th className="px-3 py-3 text-left">หมายเหตุ</th>
                                <th className="px-3 py-3 text-right">Gross</th>
                                <th className="px-3 py-3 text-right">หัก</th>
                                <th className="px-3 py-3 text-right">Net</th>
                                <th className="px-3 py-3 text-left">สิ่งเจือปน</th>
                                <th className="px-3 py-3 text-left">รูป</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {ticket.lines.map((line, index) => (
                                <tr key={line.id}>
                                  <td className="whitespace-nowrap px-3 py-3 text-slate-500">{index + 1}</td>
                                  <td className="px-3 py-3 font-medium text-slate-900">{line.productName}</td>
                                  <td className="px-3 py-3 text-slate-600">{line.note || '-'}</td>
                                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">{formatWeight(line.grossWeightValue)}</td>
                                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">{formatWeight(line.deductionWeight)}</td>
                                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-slate-900">{formatWeight(line.netWeight)}</td>
                                  <td className="px-3 py-3 text-slate-600">{line.impurityName || '-'}</td>
                                  <td className="px-3 py-3">
                                    {line.imageCount > 0 ? (
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="whitespace-nowrap text-slate-500">{line.imageCount} รูป</span>
                                        {line.imageNames.map(decodeStoredImageAsset).filter((image) => image.url).length > 0 ? (
                                          <button
                                            className="text-sm font-medium text-blue-700 hover:underline"
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              const previewableImages = line.imageNames
                                                .map(decodeStoredImageAsset)
                                                .filter((image): image is { fileName: string; rawValue: string; url: string } => Boolean(image.url))
                                                .map((image) => ({
                                                  fileName: image.fileName,
                                                  url: image.url,
                                                }))
                                              if (previewableImages.length > 0) {
                                                setLineGallery({
                                                  activeIndex: 0,
                                                  images: previewableImages,
                                                  title: line.productName,
                                                })
                                              }
                                            }}
                                          >
                                            ดูรูป
                                          </button>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>

                      <Card className="overflow-hidden p-0">
                        <div className="border-b border-slate-200 px-5 py-4">
                          <SectionTitle subtitle="รวมสินค้าชนิดเดียวกันในเอกสารเดียวกันก่อนนำไปใช้ออกบิล" title="สรุปต่อสินค้า" />
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-200/80 border-b border-slate-300/80 text-xs font-semibold text-slate-600">
                              <tr>
                                <th className="px-3 py-3 text-left">ลำดับ</th>
                                <th className="px-3 py-3 text-left">สินค้า</th>
                                <th className="px-3 py-3 text-left">จำนวน lot</th>
                                <th className="px-3 py-3 text-right">Gross รวม</th>
                                <th className="px-3 py-3 text-right">หักรวม</th>
                                <th className="px-3 py-3 text-right">Net รวม</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {ticket.productSummaries.map((summary, index) => (
                                <tr key={summary.id}>
                                  <td className="whitespace-nowrap px-3 py-3 text-slate-500">{index + 1}</td>
                                  <td className="px-3 py-3 font-medium text-slate-900">{summary.productName}</td>
                                  <td className="px-3 py-3 text-slate-600">{summary.lineCount} lot</td>
                                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">{formatWeight(summary.grossWeight)}</td>
                                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">{formatWeight(summary.deductWeight)}</td>
                                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-slate-900">{formatWeight(summary.netWeight)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </div>

                    <Card className="p-5">
                      <SectionTitle subtitle="สถานะปัจจุบันของเอกสาร" title="สถานะ" />
                      <div className="mt-4 space-y-3">
                        <div className="rounded-md bg-slate-50 px-4 py-3">
                          <div className="text-xs text-slate-500">สถานะเอกสาร</div>
                          <div className="mt-1">
                            <span className={cn(
                              'inline-flex items-center gap-1.5 text-xs font-medium',
                              weightTicketStatusBadgeClass(ticket.type, ticket.status),
                            )}
                            >
                              <span className="size-1.5 rounded-full bg-current" />
                              {displayWeightTicketStatus(ticket.type, ticket.status)}
                            </span>
                          </div>
                        </div>
                        <div className="rounded-md bg-slate-50 px-4 py-3">
                          <div className="text-xs text-slate-500">การอ้างอิงเอกสาร</div>
                          <div className="mt-1 text-sm font-medium text-slate-900">
                            {ticket.type === 'WTI'
                              ? `บิลซื้อ ${ticket.usedInPurchaseBillCount} รายการ`
                              : `บิลขาย ${ticket.usedInSalesBillCount} รายการ`}
                          </div>
                          {ticket.type === 'WTI' && ticket.usedInPurchaseBillDocNos.length > 0 ? (
                            <div className="mt-2 space-y-1 text-xs text-slate-600">
                              {ticket.usedInPurchaseBillDocNos.map((docNo) => (
                                <div key={docNo}>{docNo}</div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        {ticket.cancelledAt ? (
                          <div className="rounded-md bg-slate-50 px-4 py-3">
                            <div className="text-xs text-slate-500">ยกเลิกเมื่อ</div>
                            <div className="mt-1 text-sm font-medium text-slate-900">{formatDateTime(ticket.cancelledAt)}</div>
                          </div>
                        ) : null}
                      </div>
                    </Card>
                  </div>

                  {ticket.type === 'WTI' ? (
                    <Card className="overflow-hidden p-0">
                      <div className="border-b border-slate-200 px-5 py-4">
                        <SectionTitle subtitle="บันทึกการนำใบรับของไปออกบิลและการคืนยอด" title="ประวัติการใช้งานใบรับของ" />
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-200/80 border-b border-slate-300/80 text-xs font-semibold text-slate-600">
                            <tr>
                              <th className="px-3 py-3 text-left">เวลา</th>
                              <th className="px-3 py-3 text-left">เหตุการณ์</th>
                              <th className="px-3 py-3 text-left">สินค้า</th>
                              <th className="px-3 py-3 text-left">เอกสารปลายทาง</th>
                              <th className="px-3 py-3 text-right">น้ำหนักสุทธิ</th>
                              <th className="px-3 py-3 text-right">คงเหลือหลังรายการ</th>
                              <th className="px-3 py-3 text-left">ผู้ทำรายการ/หมายเหตุ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {ticket.usageTimeline.length === 0 ? (
                              <tr>
                                <td className="px-3 py-8 text-center text-sm text-slate-400" colSpan={7}>
                                  ยังไม่มีประวัติการใช้งาน
                                </td>
                              </tr>
                            ) : ticket.usageTimeline.map((event) => (
                              <tr key={event.id}>
                                <td className="whitespace-nowrap px-3 py-3 text-slate-500">{formatDateTime(event.createdAt)}</td>
                                <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-900">{usageActionLabel(event.action)}</td>
                                <td className="px-3 py-3">
                                  <div className="font-medium text-slate-900">{event.productName}</div>
                                  {event.productCode ? <div className="mt-0.5 text-xs text-slate-500">{event.productCode}</div> : null}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                                  {event.targetDocNo ? (
                                    <Link className="font-medium text-blue-700 hover:underline" href={`/purchase/bills/${encodeURIComponent(event.targetDocNo)}`}>
                                      {event.targetDocNo}
                                    </Link>
                                  ) : (
                                    '-'
                                  )}
                                  {event.targetLineNo ? <div className="mt-0.5 text-xs text-slate-500">รายการ {event.targetLineNo}</div> : null}
                                </td>
                                <td className={cn('whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums', usageWeightClass(event.action))}>
                                  {usageWeightLabel(event.action, event.allocatedNetWeight)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-slate-700">
                                  {event.toRemainingWeight == null ? '-' : `${formatWeight(event.toRemainingWeight)} กก.`}
                                </td>
                                <td className="min-w-48 px-3 py-3 text-slate-600">
                                  <div>{event.createdBy || '-'}</div>
                                  {event.note ? <div className="mt-1 text-xs text-slate-500">{event.note}</div> : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  ) : null}

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium text-slate-700">ประวัติเอกสาร (Timeline)</div>
                      <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', weightTicketStatusBadgeClass(ticket.type, ticket.status))}>
                        <span className="size-1.5 rounded-full bg-current" />
                        ล่าสุด: {displayWeightTicketStatus(ticket.type, ticket.status)}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {ticket.timeline.length === 0 ? (
                        <div className="text-sm text-slate-400">ยังไม่มี timeline เอกสาร</div>
                      ) : ticket.timeline.map((event, index) => {
                        const fromStatus = metadataString(event.metadata, 'fromStatus')
                        const toStatus = metadataString(event.metadata, 'toStatus')
                        const targetDocNo = metadataString(event.metadata, 'targetDocNo')
                        const productName = metadataString(event.metadata, 'productName')
                        const note = metadataString(event.metadata, 'cancelNote') || metadataString(event.metadata, 'note')
                        const allocatedNetWeight = metadataNumber(event.metadata, 'allocatedNetWeight')
                        const toRemainingWeight = metadataNumber(event.metadata, 'toRemainingWeight')
                        const isLatest = index === 0

                        return (
                          <div key={event.id} className="grid grid-cols-[88px_1fr] gap-3 sm:grid-cols-[128px_1fr]">
                            <div className="pt-1 text-right text-xs text-slate-500">
                              <div>{formatDateTime(event.occurredAt)}</div>
                              <div className="mt-1 truncate text-[11px]">{event.actorName}</div>
                            </div>
                            <div className="relative border-l border-slate-200 pb-4 pl-4 last:pb-0">
                              <span className={`absolute -left-1.5 top-1 h-3 w-3 rounded-full border-2 border-white ${timelineDotClass(event.action, isLatest)}`} />
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="text-sm font-medium text-slate-800">{timelineLabel(event.eventKey, event.action)}</div>
                                {toStatus ? (
                                  <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', weightTicketStatusBadgeClass(ticket.type, toStatus as WeightTicketStatus))}>
                                    <span className="size-1.5 rounded-full bg-current" />
                                    {timelineStatusLabel(ticket.type, toStatus)}
                                  </span>
                                ) : null}
                              </div>
                              {fromStatus && fromStatus !== toStatus ? (
                                <div className="mt-1 text-xs text-slate-500">
                                  เปลี่ยนสถานะจาก {timelineStatusLabel(ticket.type, fromStatus)}
                                </div>
                              ) : null}
                              <div className="mt-2 grid gap-1 rounded-md bg-white px-3 py-2 text-xs text-slate-600 shadow-sm border border-slate-200">
                                {targetDocNo || productName || allocatedNetWeight != null ? (
                                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                                    {targetDocNo ? (
                                      <Link className="font-medium text-blue-700 hover:underline" href={`/purchase/bills/${encodeURIComponent(targetDocNo)}`}>
                                        {targetDocNo}
                                      </Link>
                                    ) : null}
                                    {productName ? <span>{productName}</span> : null}
                                    {allocatedNetWeight != null ? <span>น้ำหนัก: {formatWeight(allocatedNetWeight)} กก.</span> : null}
                                    {toRemainingWeight != null ? <span>คงเหลือ: {formatWeight(toRemainingWeight)} กก.</span> : null}
                                  </div>
                                ) : null}
                                {note ? (
                                  <div className="text-slate-700">{note}</div>
                                ) : null}
                                {!targetDocNo && !productName && allocatedNetWeight == null && !note ? (
                                  <div className="text-slate-400">อัปเดตข้อมูล</div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )
                })}
              </div>
            </div>

            {ticket.canCancel ? (
              <Card className="p-5">
                <SectionTitle subtitle="ยกเลิกได้จนกว่าจะถูกนำไปใช้ออกบิล" title="ยกเลิกเอกสาร" />
                <div className="mt-4 space-y-3 px-1">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      เหตุผลการยกเลิก<span className="ml-1 text-red-600">*</span>
                    </label>
                    <textarea
                      className="block min-h-[88px] w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
                      placeholder="ระบุเหตุผลการยกเลิก"
                      value={cancelNote}
                      onChange={(event) => setCancelNote(event.target.value)}
                    />
                    {cancelError ? <div className="mt-1 text-xs text-red-600">{cancelError}</div> : null}
                  </div>
                  <Button disabled={isCanceling} type="button" variant="outline" onClick={handleCancelTicket}>
                    <XCircle className="mr-2 size-4" />
                    {isCanceling ? 'กำลังยกเลิก...' : 'ยกเลิกเอกสาร'}
                  </Button>
                </div>
              </Card>
            ) : null}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MOBILE / TABLET LAYOUT (แสดงผลตามรูปภาพ Accordion + Grid 2x2) */}
          {/* ========================================================================= */}
          <div className="block lg:hidden space-y-4">
            {/* 1. ข้อมูลเอกสาร (มีปุ่ม ดูทั้งหมด/ดูน้อยลง) */}
            <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="font-semibold text-slate-800 text-sm">ข้อมูลเอกสาร</h3>
                <button
                  type="button"
                  className="text-xs font-medium text-blue-600 hover:underline flex items-center gap-0.5"
                  onClick={() => setIsDocInfoExpanded(!isDocInfoExpanded)}
                >
                  {isDocInfoExpanded ? 'ดูน้อยลง' : 'ดูทั้งหมด'}
                  {isDocInfoExpanded ? <ChevronUp className="size-3" /> : <ChevronRight className="size-3" />}
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-slate-500">{ticket.type === 'WTI' ? 'ใบรับของ' : 'ใบส่งของ'}</div>
                  <div className="font-semibold text-slate-800">{ticket.documentNo}</div>
                </div>
                <div>
                  <div className="text-slate-500">วันที่/เวลาสร้าง</div>
                  <div className="font-semibold text-slate-800">{formatDateTime(ticket.createdAt)}</div>
                </div>
                <div>
                  <div className="text-slate-500">ผู้กรอก</div>
                  <div className="font-semibold text-slate-800">{ticket.enteredBy || '-'}</div>
                </div>
                <div>
                  <div className="text-slate-500">อัปเดตล่าสุด</div>
                  <div className="font-semibold text-slate-800">{formatDateTime(ticket.updatedAt || ticket.createdAt)}</div>
                </div>

                {isDocInfoExpanded && (
                  <>
                    <div>
                      <div className="text-slate-500">ผู้แก้ไขล่าสุด</div>
                      <div className="font-semibold text-slate-800">{ticket.updatedBy || '-'}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">การอ้างอิงบิล</div>
                      <div className="font-semibold text-slate-800">
                        {ticket.type === 'WTI'
                          ? `${ticket.usedInPurchaseBillCount} รายการ`
                          : `${ticket.usedInSalesBillCount} รายการ`}
                      </div>
                    </div>
                    {ticket.type === 'WTI' && ticket.usedInPurchaseBillDocNos.length > 0 && (
                      <div className="col-span-2">
                        <div className="text-slate-500">เลขที่บิลซื้อที่อ้างอิง</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {ticket.usedInPurchaseBillDocNos.map((docNo) => (
                            <span key={docNo} className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 font-medium text-[10px]">
                              {docNo}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {ticket.remark && (
                      <div className="col-span-2">
                        <div className="text-slate-500 font-medium">หมายเหตุ</div>
                        <div className="font-semibold text-slate-800 whitespace-pre-wrap">{ticket.remark}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* แบนเนอร์แจ้งเตือนเอกสารล็อก (ไม่ให้แก้ไข/ยกเลิก) */}
            {!ticket.canEdit || !ticket.canCancel ? (
              <div className="rounded-md bg-amber-50 px-3 py-2.5 text-xs text-amber-800 border border-amber-100 leading-relaxed">
                ⚠️ เอกสารถูกนำไปใช้กับบิลรับซื้อหรือบิลขายแล้ว จึงไม่สามารถแก้ไขหรือยกเลิกได้
              </div>
            ) : null}

            {/* 2. Grid Metrics 2x2 (สาขา, น้ำหนักสุทธิ, สินค้ารวม, สถานะเอกสาร) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm flex flex-col justify-between min-h-16">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <ClipboardList className="size-3.5" />
                  <span>สาขา</span>
                </div>
                <div className="mt-1.5 text-xs sm:text-sm font-semibold text-slate-900">{ticket.branchName}</div>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm flex flex-col justify-between min-h-16">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Scale className="size-3.5" />
                  <span>น้ำหนักสุทธิ</span>
                </div>
                <div className="mt-1.5 text-xs sm:text-sm font-bold text-slate-900 tabular-nums">
                  {formatWeight(ticket.totals.netWeight)} กก.
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm flex flex-col justify-between min-h-16">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Package2 className="size-3.5" />
                  <span>สินค้ารวม</span>
                </div>
                <div className="mt-1.5 text-xs sm:text-sm font-semibold text-slate-900">
                  {ticket.productSummaries.length} สินค้า / {ticket.lines.length} lot
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm flex flex-col justify-between min-h-16">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="size-1.5 rounded-full bg-slate-400" />
                  <span>สถานะเอกสาร</span>
                </div>
                <div className="mt-1.5">
                  <span className={cn(
                    'inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full',
                    weightTicketStatusBadgeClass(ticket.type, ticket.status)
                  )}>
                    <span className="size-1 rounded-full bg-current" />
                    {displayWeightTicketStatus(ticket.type, ticket.status)}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Accordions พับเก็บได้ 5 ส่วน */}
            <div className="space-y-3">
              {/* Accordion 1: ข้อมูลคู่ค้า */}
              <AccordionSection
                title={ticket.type === 'WTI' ? 'ข้อมูลผู้ขาย' : 'ข้อมูลลูกค้า'}
                isOpen={expandedSections.partyInfo}
                onToggle={() => setExpandedSections(prev => ({ ...prev, partyInfo: !prev.partyInfo }))}
              >
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="text-slate-500">{ticket.type === 'WTI' ? 'ผู้ขาย' : 'ลูกค้า'}</div>
                    <div className="font-semibold text-slate-800 text-sm mt-0.5">{ticket.partyName}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">ทะเบียนรถ</div>
                    <div className="font-semibold text-slate-800 text-sm mt-0.5">{ticket.vehicleNo || '-'}</div>
                  </div>
                  <div>
                    <div className="mb-2 text-slate-500 font-medium">รูปภาพรถส่งของ</div>
                    <ImageGrid images={vehicleImages} onOpen={(image) => setPreviewImage(image)} />
                  </div>
                </div>
              </AccordionSection>

              {/* Accordion 2: รายการสินค้าแยกตาม lot */}
              <AccordionSection
                title="รายการสินค้าแยกตาม lot"
                isOpen={expandedSections.lines}
                onToggle={() => setExpandedSections(prev => ({ ...prev, lines: !prev.lines }))}
              >
                <div className="space-y-2.5">
                  {ticket.lines.map((line, index) => (
                    <button
                      key={line.id}
                      type="button"
                      className="w-full text-left rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50 transition flex items-center justify-between gap-3 shadow-sm"
                      onClick={() => setSelectedLineDetail(line)}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate text-xs sm:text-sm">
                          {index + 1}. {line.productName}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 flex flex-wrap gap-x-2 gap-y-0.5">
                          <span>Gross: {formatWeight(line.grossWeightValue)}</span>
                          <span>•</span>
                          <span>หัก: {formatWeight(line.deductionWeight)}</span>
                        </div>
                        {line.imageCount > 0 && (
                          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-semibold text-blue-600">
                            📷 {line.imageCount} รูป
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] text-slate-400 font-medium">น้ำหนักสุทธิ</div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900 tabular-nums">
                          {formatWeight(line.netWeight)} กก.
                        </div>
                        <div className="mt-1 text-[10px] text-blue-600 font-semibold flex items-center gap-0.5 justify-end">
                          <span>ดูรายละเอียด</span>
                          <ChevronRight className="size-3" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </AccordionSection>

              {/* Accordion 3: สรุปต่อสินค้า */}
              <AccordionSection
                title="สรุปต่อสินค้า"
                isOpen={expandedSections.summaries}
                onToggle={() => setExpandedSections(prev => ({ ...prev, summaries: !prev.summaries }))}
              >
                <div className="space-y-2.5">
                  {ticket.productSummaries.map((summary, index) => (
                    <div key={summary.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs">
                      <div className="flex items-start justify-between gap-3 border-b border-slate-200/50 pb-1.5 mb-1.5">
                        <div className="font-semibold text-slate-800 text-xs sm:text-sm">
                          {index + 1}. {summary.productName}
                        </div>
                        <span className="rounded bg-slate-200 px-2 py-0.5 text-[9px] text-slate-700 font-bold">
                          {summary.lineCount} lot
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-slate-600 text-[11px]">
                        <div>
                          <span className="block text-slate-400">Gross รวม</span>
                          <span className="font-semibold text-slate-800 tabular-nums">{formatWeight(summary.grossWeight)}</span>
                        </div>
                        <div>
                          <span className="block text-slate-400">หักรวม</span>
                          <span className="font-semibold text-slate-800 tabular-nums">{formatWeight(summary.deductWeight)}</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-slate-400">Net รวม</span>
                          <span className="font-bold text-slate-900 tabular-nums text-xs">{formatWeight(summary.netWeight)} กก.</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionSection>

              {/* Accordion 4: ประวัติการใช้งานใบรับของ */}
              {ticket.type === 'WTI' && (
                <AccordionSection
                  title="ประวัติการใช้งานใบรับของ"
                  isOpen={expandedSections.usage}
                  onToggle={() => setExpandedSections(prev => ({ ...prev, usage: !prev.usage }))}
                >
                  <div className="space-y-2.5">
                    {ticket.usageTimeline.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">ยังไม่มีประวัติการใช้งาน</div>
                    ) : (
                      ticket.usageTimeline.map((event) => (
                        <div key={event.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs">
                          <div className="flex items-center justify-between gap-3 border-b border-slate-200/50 pb-1.5 mb-1.5">
                            <span className="font-semibold text-slate-400 text-[10px]">{formatDateTime(event.createdAt)}</span>
                            <span className={cn(
                              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold',
                              event.action === 'released_from_purchase_bill' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                            )}>
                              {usageActionLabel(event.action)}
                            </span>
                          </div>
                          <div className="space-y-1 text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-slate-400">สินค้า:</span>
                              <span className="font-semibold text-slate-800">{event.productName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">เอกสารปลายทาง:</span>
                              <span>
                                {event.targetDocNo ? (
                                  <Link className="font-semibold text-blue-600 hover:underline" href={`/purchase/bills/${encodeURIComponent(event.targetDocNo)}`}>
                                    {event.targetDocNo}
                                  </Link>
                                ) : (
                                  '-'
                                )}
                                {event.targetLineNo ? ` (รายการ ${event.targetLineNo})` : ''}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">น้ำหนักสุทธิ:</span>
                              <span className={cn('font-bold tabular-nums', usageWeightClass(event.action))}>
                                {usageWeightLabel(event.action, event.allocatedNetWeight)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">คงเหลือหลังรายการ:</span>
                              <span className="font-semibold text-slate-800 tabular-nums">
                                {event.toRemainingWeight == null ? '-' : `${formatWeight(event.toRemainingWeight)} กก.`}
                              </span>
                            </div>
                            {(event.createdBy || event.note) && (
                              <div className="mt-1.5 border-t border-slate-200/40 pt-1.5 text-[10px] text-slate-500">
                                <div>ผู้ทำรายการ: {event.createdBy || '-'}</div>
                                {event.note ? <div className="mt-0.5 text-slate-600">หมายเหตุ: {event.note}</div> : null}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </AccordionSection>
              )}

              {/* Accordion 5: ประวัติเอกสาร (Timeline) */}
              <AccordionSection
                title="ประวัติเอกสาร (Timeline)"
                isOpen={expandedSections.timeline}
                onToggle={() => setExpandedSections(prev => ({ ...prev, timeline: !prev.timeline }))}
              >
                <div className="space-y-4 pl-1 text-xs">
                  {ticket.timeline.length === 0 ? (
                    <div className="text-slate-400 py-4 text-center">ยังไม่มี timeline เอกสาร</div>
                  ) : (
                    ticket.timeline.map((event, index) => {
                      const fromStatus = metadataString(event.metadata, 'fromStatus')
                      const toStatus = metadataString(event.metadata, 'toStatus')
                      const targetDocNo = metadataString(event.metadata, 'targetDocNo')
                      const productName = metadataString(event.metadata, 'productName')
                      const note = metadataString(event.metadata, 'cancelNote') || metadataString(event.metadata, 'note')
                      const allocatedNetWeight = metadataNumber(event.metadata, 'allocatedNetWeight')
                      const toRemainingWeight = metadataNumber(event.metadata, 'toRemainingWeight')
                      const isLatest = index === 0

                      return (
                        <div key={event.id} className="relative border-l border-slate-200 pb-3 pl-4 last:pb-0">
                          <span className={cn(
                            'absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white',
                            timelineDotClass(event.action, isLatest)
                          )} />
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-slate-800">{timelineLabel(event.eventKey, event.action)}</span>
                            {toStatus && (
                              <span className={cn(
                                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
                                weightTicketStatusBadgeClass(ticket.type, toStatus as WeightTicketStatus)
                              )}>
                                {timelineStatusLabel(ticket.type, toStatus)}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            {formatDateTime(event.occurredAt)} · {event.actorName}
                          </div>
                          {fromStatus && fromStatus !== toStatus && (
                            <div className="mt-0.5 text-[10px] text-slate-400">
                              เปลี่ยนสถานะจาก {timelineStatusLabel(ticket.type, fromStatus)}
                            </div>
                          )}
                          <div className="mt-1.5 rounded-md bg-slate-50 p-2 text-[11px] text-slate-600 border border-slate-200">
                            {targetDocNo || productName || allocatedNetWeight != null ? (
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 font-semibold">
                                {targetDocNo && (
                                  <Link className="text-blue-600 hover:underline" href={`/purchase/bills/${encodeURIComponent(targetDocNo)}`}>
                                    {targetDocNo}
                                  </Link>
                                )}
                                {productName && <span>{productName}</span>}
                                {allocatedNetWeight != null && <span>{formatWeight(allocatedNetWeight)} กก.</span>}
                                {toRemainingWeight != null && <span>คงเหลือ: {formatWeight(toRemainingWeight)} กก.</span>}
                              </div>
                            ) : null}
                            {note ? (
                              <div className="mt-1 text-slate-700">{note}</div>
                            ) : null}
                            {!targetDocNo && !productName && allocatedNetWeight == null && !note ? (
                              <div className="text-slate-400">อัปเดตข้อมูล</div>
                            ) : null}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </AccordionSection>
            </div>

            {/* 4. กล่องยกเลิกเอกสาร (แสดงเมื่อยื่นยกเลิกได้) */}
            {ticket.canCancel ? (
              <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <h3 className="font-semibold text-slate-800 text-sm">ยกเลิกเอกสาร</h3>
                <p className="text-[11px] text-slate-500">ยกเลิกได้จนกว่าจะถูกนำไปใช้ออกบิล</p>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-600">
                    เหตุผลการยกเลิก<span className="ml-1 text-red-600">*</span>
                  </label>
                  <textarea
                    className="block min-h-[64px] w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
                    placeholder="ระบุเหตุผลการยกเลิก"
                    value={cancelNote}
                    onChange={(event) => setCancelNote(event.target.value)}
                  />
                  {cancelError ? <div className="mt-1 text-xs text-red-600">{cancelError}</div> : null}
                </div>
                <Button disabled={isCanceling} type="button" variant="outline" className="w-full text-xs" onClick={handleCancelTicket}>
                  <XCircle className="mr-2 size-4" />
                  {isCanceling ? 'กำลังยกเลิก...' : 'ยกเลิกเอกสาร'}
                </Button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>

        <DialogFooter className="shrink-0 p-4 border-t border-slate-200 bg-slate-50 rounded-b-none md:rounded-b-md">
          <Button className="font-normal" type="button" variant="outline" onClick={onClose}>ปิด</Button>
        </DialogFooter>

        {previewImage && (
          <Dialog open onOpenChange={(open) => {
            if (!open) setPreviewImage(null)
          }}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>รูปภาพแนบ</DialogTitle>
                <DialogDescription>{previewImage.fileName}</DialogDescription>
              </DialogHeader>
              <div className="overflow-hidden rounded-md bg-slate-950">
                <Image
                  alt={previewImage.fileName}
                  className="max-h-[70vh] w-full object-contain"
                  height={1200}
                  src={previewImage.url}
                  unoptimized
                  width={1600}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}

        {lineGallery && activeGalleryImage && (
          <Dialog open onOpenChange={(open) => {
            if (!open) setLineGallery(null)
          }}>
            <DialogContent className="max-w-5xl">
              <DialogHeader>
                <DialogTitle>{lineGallery.title}</DialogTitle>
                <DialogDescription>
                  {activeGalleryImage.fileName} · รูป {lineGallery.activeIndex + 1} / {lineGallery.images.length}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-md bg-slate-950">
                  <Image
                    alt={activeGalleryImage.fileName}
                    className="max-h-[70vh] w-full object-contain"
                    height={1200}
                    src={activeGalleryImage.url}
                    unoptimized
                    width={1600}
                  />
                  {lineGallery.images.length > 1 ? (
                    <>
                      <button
                        className="absolute left-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
                        type="button"
                        onClick={() => setLineGallery((current) => current ? ({
                          ...current,
                          activeIndex: current.activeIndex === 0 ? current.images.length - 1 : current.activeIndex - 1,
                        }) : current)}
                      >
                        <ChevronLeft className="size-5" />
                      </button>
                      <button
                        className="absolute right-3 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
                        type="button"
                        onClick={() => setLineGallery((current) => current ? ({
                          ...current,
                          activeIndex: current.activeIndex === current.images.length - 1 ? 0 : current.activeIndex + 1,
                        }) : current)}
                      >
                        <ChevronRight className="size-5" />
                      </button>
                    </>
                  ) : null}
                </div>
                {lineGallery.images.length > 1 ? (
                  <div className="grid grid-cols-4 gap-3 md:grid-cols-6">
                    {lineGallery.images.map((image, index) => (
                      <button
                        className={cn(
                          'overflow-hidden rounded-md border bg-slate-50 text-left transition',
                          index === lineGallery.activeIndex ? 'border-blue-500 ring-1 ring-blue-200' : 'border-slate-200 hover:border-slate-300',
                        )}
                        key={`${image.fileName}-${index}`}
                        type="button"
                        onClick={() => setLineGallery((current) => current ? ({ ...current, activeIndex: index }) : current)}
                      >
                        <div className="relative aspect-[4/3] bg-slate-200">
                          <Image alt={image.fileName} className="object-cover" fill sizes="20vw" src={image.url} unoptimized />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {selectedLineDetail && (
          <Dialog open onOpenChange={(open) => {
            if (!open) setSelectedLineDetail(null)
          }}>
            <DialogContent className="max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden p-0 rounded-md">
              <DialogHeader className="shrink-0 border-b border-slate-200 p-4">
                <DialogTitle className="text-base font-bold text-slate-900">
                  รายละเอียดสินค้า
                </DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <span className="text-xs text-slate-500">ชื่อสินค้า</span>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                    {selectedLineDetail.productName}
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-3">
                  <div>
                    <span className="text-xs text-slate-500">คลังสินค้า</span>
                    <div className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5">
                      {selectedLineDetail.warehouseName || '-'}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">สิ่งเจือปน</span>
                    <div className="text-xs sm:text-sm font-semibold text-slate-800 mt-0.5">
                      {selectedLineDetail.impurityName || '-'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Gross</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-700 tabular-nums">
                      {formatWeight(selectedLineDetail.grossWeightValue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">หัก</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-700 tabular-nums">
                      {formatWeight(selectedLineDetail.deductionWeight)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Net</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 tabular-nums">
                      {formatWeight(selectedLineDetail.netWeight)} กก.
                    </span>
                  </div>
                </div>

                {selectedLineDetail.note && (
                  <div className="border-t border-slate-200 pt-3">
                    <span className="text-xs text-slate-500">หมายเหตุ</span>
                    <p className="text-xs sm:text-sm text-slate-600 mt-0.5 whitespace-pre-wrap">
                      {selectedLineDetail.note}
                    </p>
                  </div>
                )}

                {selectedLineDetail.imageNames.length > 0 && (
                  <div className="border-t border-slate-200 pt-3">
                    <span className="text-xs text-slate-500 block mb-2">รูปภาพสินค้า</span>
                    <ImageGrid
                      images={selectedLineDetail.imageNames.map(decodeStoredImageAsset)}
                      onOpen={(image) => setPreviewImage(image)}
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="shrink-0 p-3 border-t border-slate-200 bg-slate-50">
                <Button className="w-full sm:w-auto font-normal" type="button" variant="outline" onClick={() => setSelectedLineDetail(null)}>
                  ปิด
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SectionTitle({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  )
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs uppercase text-slate-500">{icon}{label}</div>
      <div className="mt-2 text-lg font-semibold tabular-nums text-slate-950">{value}</div>
    </div>
  )
}

function DetailItem({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cn('mt-1 text-sm font-medium text-slate-900', valueClassName)}>{value}</div>
    </div>
  )
}

function ImageGrid({
  images,
  onOpen,
}: {
  images: Array<{ fileName: string; rawValue: string; url: string | null }>
  onOpen: (image: { fileName: string; url: string }) => void
}) {
  if (images.length === 0) {
    return <div className="text-sm text-slate-400">ยังไม่มีรูปภาพ</div>
  }

  const previewable = images.filter((image) => image.url)
  const filenameOnly = images.filter((image) => !image.url)

  return (
    <div className="space-y-3">
      {previewable.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          {previewable.map((image, index) => (
            <button
              className="overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-left transition hover:border-slate-300 hover:bg-slate-100"
              key={`${image.rawValue}-${index}`}
              type="button"
              onClick={() => onOpen({ fileName: image.fileName, url: image.url ?? '' })}
            >
              <div className="relative aspect-[4/3] bg-slate-200">
                <Image alt={image.fileName} className="object-cover" fill sizes="(max-width: 768px) 50vw, 20vw" src={image.url ?? ''} unoptimized />
              </div>
              <div className="truncate px-3 py-2 text-xs text-slate-600">{image.fileName}</div>
            </button>
          ))}
        </div>
      ) : null}
      {filenameOnly.length > 0 ? (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          มีรูปเดิม {filenameOnly.length} รูปที่ยังไม่มี preview ในระบบปัจจุบัน
        </div>
      ) : null}
    </div>
  )
}
