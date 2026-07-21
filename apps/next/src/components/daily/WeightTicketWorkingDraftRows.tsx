'use client'

import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog'
import type { WeightTicketType } from '@/lib/weight-tickets'
import { formatWeight } from '@/lib/weight-tickets'
import type { WeightTicketTeamDraft } from '@/lib/weight-ticket-drafts'
import { cn } from '@/lib/utils'

type WorkingDraftRowProps = {
  draft: WeightTicketTeamDraft
  onOpen: (draft: WeightTicketTeamDraft) => void
  typeFilter: WeightTicketType
}

type WorkingDraftDetailDialogProps = {
  draft: WeightTicketTeamDraft | null
  onClose: () => void
}

function formatSavedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('th-TH', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function productSummary(draft: WeightTicketTeamDraft) {
  const selectedProducts = draft.productNames.length ? draft.productNames.join(' · ') : 'ยังไม่ได้เลือกสินค้า'
  return draft.otherProductCount > 0
    ? `${selectedProducts} และอีก ${draft.otherProductCount} สินค้า`
    : selectedProducts
}

function documentLabel(draft: WeightTicketTeamDraft) {
  return draft.documentNo || 'ร่างใหม่'
}

function statusBadge() {
  return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
}

function DraftMetric({ label, value, tone = 'text-slate-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={cn('mt-1 text-base font-bold tabular-nums', tone)}>{formatWeight(value)} กก.</div>
    </div>
  )
}

export function WeightTicketWorkingDraftMobileCard({ draft, onOpen, typeFilter }: WorkingDraftRowProps) {
  return (
    <button
      aria-label={`ดูรายละเอียดร่าง ${documentLabel(draft)} ของ ${draft.drafterName}`}
      className="block w-full space-y-3 rounded-xl border border-amber-200 bg-amber-50/30 p-4 text-left shadow-sm transition hover:border-amber-300 hover:bg-amber-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      data-working-draft-row="true"
      data-working-draft-key={draft.draftKey}
      onClick={() => onOpen(draft)}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-bold text-slate-900">{documentLabel(draft)}</div>
          <div className="mt-0.5 text-xs font-medium text-amber-700">กำลังกรอก · {draft.activityDescription}</div>
        </div>
        <span className="whitespace-nowrap text-xs text-slate-500">{formatSavedAt(draft.savedAt)}</span>
      </div>

      <div className="space-y-1.5 rounded-md border border-amber-100 bg-white p-3 text-sm text-slate-700">
        <div><span className="font-semibold text-slate-500">{typeFilter === 'WTI' ? 'ผู้ขาย: ' : 'ลูกค้า: '}</span><span className="text-slate-900">{draft.partyName || '-'}</span></div>
        <div><span className="font-semibold text-slate-500">ทะเบียนรถ: </span><span className="text-slate-900">-</span></div>
        <div><span className="font-semibold text-slate-500">สาขา: </span><span className="text-slate-900">{draft.branchName}</span></div>
        <div><span className="font-semibold text-slate-500">สินค้า/เต๋า: </span><span className="text-slate-900">{productSummary(draft)} · {draft.lineCount.toLocaleString('th-TH')} รายการ</span></div>
      </div>

      <div className="flex items-center justify-between border-t border-amber-100 pt-2.5">
        <span className={cn('inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-sm font-semibold', statusBadge())}>
          <span className="size-1.5 rounded-full bg-current" />
          กำลังกรอก
        </span>
        <div className="text-right">
          <span className="block text-xs text-slate-500">น้ำหนักสุทธิ</span>
          <span className="text-base font-bold tabular-nums text-emerald-700">{formatWeight(draft.netWeight)} กก.</span>
        </div>
      </div>
    </button>
  )
}

export function WeightTicketWorkingDraftDesktopRow({ draft, onOpen, typeFilter }: WorkingDraftRowProps) {
  return (
    <tr
      className="cursor-pointer bg-amber-50/30 transition hover:bg-amber-50/60"
      data-working-draft-row="true"
      data-working-draft-key={draft.draftKey}
      onClick={() => onOpen(draft)}
    >
      <td className="relative whitespace-nowrap px-3 py-3 text-slate-900">
        <span className="absolute inset-y-0 left-0 w-1.5 bg-amber-400" />
        <div className="pl-2 font-semibold">{documentLabel(draft)}</div>
        <div className="pl-2 text-xs text-amber-700">กำลังกรอก</div>
      </td>
      <td className={cn('whitespace-nowrap px-3 py-3 text-slate-600', typeFilter === 'WTI' ? 'ns-table-textual-column' : undefined)}>
        <div>{formatSavedAt(draft.savedAt).split(' ')[0]}</div>
        <div className="mt-0.5 text-xs text-slate-400">{formatSavedAt(draft.savedAt).split(' ').slice(1).join(' ')}</div>
      </td>
      <td className={cn('px-3 py-3 text-slate-900', typeFilter === 'WTI' ? 'ns-table-textual-column' : undefined)}>
        <div className="truncate">{draft.partyName || '-'}</div>
        <div className="mt-0.5 truncate text-xs text-amber-700">{draft.activityDescription}</div>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{draft.branchName}</td>
      <td className="whitespace-nowrap px-3 py-3 text-slate-600">-</td>
      <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums text-slate-900">{formatWeight(draft.netWeight)} กก.</td>
      <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums text-slate-900">{formatWeight(draft.containerDeductionWeight ?? 0)} กก.</td>
      <td className="box-border h-[39px] w-[140px] px-3 py-2">
        <span className={cn('inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold', statusBadge())}>
          <span className="size-1.5 rounded-full bg-current" />
          กำลังกรอก
        </span>
      </td>
      <td className="px-3 py-3 text-slate-600">
        <div className="truncate">{draft.drafterName}</div>
        <div className="text-xs text-slate-400">{formatSavedAt(draft.savedAt)}</div>
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right">
        <button
          aria-label={`ดูรายละเอียดร่าง ${documentLabel(draft)} ของ ${draft.drafterName}`}
          className="text-xs font-medium text-blue-700 hover:text-blue-800 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          onClick={(event) => {
            event.stopPropagation()
            onOpen(draft)
          }}
          type="button"
        >
          ดูรายละเอียด
        </button>
      </td>
    </tr>
  )
}

export function WeightTicketWorkingDraftDetailDialog({ draft, onClose }: WorkingDraftDetailDialogProps) {
  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => {
      if (!open) onClose()
    }}>
      <DialogContent
        aria-labelledby="weight-ticket-working-draft-detail-title"
        className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden rounded-md border-0 bg-slate-900 !p-0 shadow-2xl outline-none focus:outline-none"
        hideClose
        mobileAppShell={false}
      >
        {draft ? (
          <>
            <DialogHeader>
              <DialogTitle id="weight-ticket-working-draft-detail-title" className="truncate">รายละเอียดร่าง {documentLabel(draft)}</DialogTitle>
              <DialogDescription className="truncate">{draft.partyName || (draft.type === 'WTI' ? 'ยังไม่เลือกผู้ขาย' : 'ยังไม่เลือกลูกค้า')}</DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4 text-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
                <span className={cn('inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-sm font-semibold', statusBadge())}>
                  <span className="size-1.5 rounded-full bg-current" />
                  กำลังกรอก
                </span>
                <span className="text-xs text-slate-600">ข้อมูลอัปเดตอัตโนมัติจากตารางทุก 3 วินาที</span>
              </div>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold text-slate-800">ข้อมูลร่างล่าสุด</h3>
                <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
                  <div><dt className="text-xs font-medium text-slate-500">ประเภท</dt><dd className="mt-0.5 text-slate-900">{draft.type === 'WTI' ? 'ใบรับของ WTI' : 'ใบส่งของ WTO'}</dd></div>
                  <div><dt className="text-xs font-medium text-slate-500">ผู้กรอก</dt><dd className="mt-0.5 text-slate-900">{draft.drafterName}</dd></div>
                  <div><dt className="text-xs font-medium text-slate-500">สาขา</dt><dd className="mt-0.5 text-slate-900">{draft.branchName}</dd></div>
                  <div><dt className="text-xs font-medium text-slate-500">อัปเดตล่าสุด</dt><dd className="mt-0.5 text-slate-900">{formatSavedAt(draft.savedAt)}</dd></div>
                  <div className="col-span-2"><dt className="text-xs font-medium text-slate-500">สินค้า/เต๋า</dt><dd className="mt-0.5 text-slate-900">{productSummary(draft)} · {draft.lineCount.toLocaleString('th-TH')} รายการ</dd></div>
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold text-slate-800">สรุปน้ำหนัก</h3>
                <div className="grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-4">
                  <DraftMetric label="น้ำหนักรวม" value={draft.grossWeight} />
                  <DraftMetric label="หักภาชนะ" value={draft.containerDeductionWeight ?? 0} />
                  <DraftMetric label="หักสิ่งเจือปน" value={draft.deductionWeight ?? 0} />
                  <DraftMetric label="น้ำหนักสุทธิ" tone="text-emerald-700" value={draft.netWeight} />
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 border-b border-slate-100 pb-2 text-sm font-bold text-slate-800">อัปเดตล่าสุด</h3>
                <p className="text-sm text-slate-700">{draft.activityDescription}</p>
                <p className="mt-1 text-xs text-slate-500">บันทึกร่างเมื่อ {formatSavedAt(draft.savedAt)}</p>
              </section>

              <p className="text-xs text-slate-500">หน้านี้เป็นข้อมูลอ่านอย่างเดียว ผู้ใช้อื่นไม่สามารถแก้ไขหรือบันทึกร่างแทนผู้กรอกได้</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>ปิด</Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
