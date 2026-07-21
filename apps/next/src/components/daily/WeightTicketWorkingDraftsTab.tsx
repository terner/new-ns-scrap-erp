'use client'

import { useEffect, useMemo, useState } from 'react'

import { formatWeight } from '@/lib/weight-tickets'
import { getWeightTicketTeamDrafts, type WeightTicketTeamDraft } from '@/lib/weight-ticket-drafts'

type WeightTicketWorkingDraftsTabProps = {
  branchCode: string | null
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

function typeLabel(type: WeightTicketTeamDraft['type']) {
  return type === 'WTI' ? 'ใบรับของ WTI' : 'ใบส่งของ WTO'
}

function activityDetailLabel(activityDetail: WeightTicketTeamDraft['activityDetail']) {
  return {
    attachment: 'แนบหรือแก้ไขรูปภาพ',
    branch: 'เปลี่ยนสาขา',
    deduction: 'แก้ไขการหักน้ำหนัก',
    document: 'แก้ไขข้อมูลเอกสาร',
    godown: 'แก้ไขลาน/โกดัง',
    'impurity-added': 'เพิ่มสิ่งเจือปน',
    'impurity-purchase': 'ตั้งค่าซื้อสินค้าจากสิ่งเจือปน',
    'impurity-removed': 'ลบสิ่งเจือปน',
    'line-added': 'เพิ่มรายการสินค้า',
    'line-changed': 'แก้ไขรายการสินค้า',
    'line-removed': 'ลบรายการสินค้า',
    'lot-added': 'เพิ่มเต๋าชั่ง',
    'lot-removed': 'ลบเต๋าชั่ง',
    party: 'เปลี่ยนคู่ค้า',
    product: 'เลือกหรือเปลี่ยนสินค้า',
    remark: 'แก้ไขหมายเหตุ',
    vehicle: 'แก้ไขทะเบียนรถ',
    warehouse: 'เปลี่ยนคลัง',
    weight: 'แก้ไขน้ำหนักชั่ง',
  }[activityDetail]
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

export function WeightTicketWorkingDraftsTab({ branchCode }: WeightTicketWorkingDraftsTabProps) {
  const [drafts, setDrafts] = useState<WeightTicketTeamDraft[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    let cancelled = false
    let isRequesting = false
    let requestController: AbortController | null = null

    async function loadDrafts() {
      if (document.visibilityState === 'hidden' || isRequesting) return
      isRequesting = true
      const controller = new AbortController()
      requestController = controller
      try {
        const result = await getWeightTicketTeamDrafts({ signal: controller.signal })
        if (!cancelled) {
          setDrafts(result.drafts)
          setTruncated(result.truncated)
          setLoadError('')
        }
      } catch {
        if (!cancelled && !controller.signal.aborted) {
          setDrafts([])
          setTruncated(false)
          setLoadError('ไม่สามารถโหลดแบบร่างล่าสุดได้')
        }
      } finally {
        if (requestController === controller) requestController = null
        isRequesting = false
        if (!cancelled) setIsLoading(false)
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void loadDrafts()
        return
      }
      requestController?.abort()
    }

    void loadDrafts()
    const intervalId = window.setInterval(() => void loadDrafts(), 3_000)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      cancelled = true
      requestController?.abort()
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const visibleDrafts = useMemo(() => (
    branchCode === 'all' ? drafts : drafts.filter((draft) => draft.branchId === branchCode)
  ), [branchCode, drafts])

  if (isLoading) {
    return <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">กำลังโหลดแบบร่างล่าสุด</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">แบบร่างที่เพิ่งอัปเดต</h2>
          <p className="mt-0.5 text-xs text-slate-500">ดูแบบอ่านอย่างเดียวว่าใครเพิ่งแก้ไขส่วนใดของร่าง รีเฟรชทุก 3 วินาที และแสดงเฉพาะ 5 นาทีล่าสุด</p>
        </div>
        <span className="text-xs text-slate-500">{visibleDrafts.length.toLocaleString('th-TH')} รายการ</span>
      </div>

      {loadError ? <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</div> : null}
      {truncated ? <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">แสดงรายการที่อัปเดตล่าสุดบางส่วน</div> : null}

      {visibleDrafts.length === 0 ? (
        <div className="rounded-md border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">ยังไม่มีแบบร่างที่เพิ่งอัปเดตในขณะนี้</div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="ns-table min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="whitespace-nowrap p-2 text-left">ผู้ร่าง / สิ่งที่เพิ่งบันทึกร่าง</th>
                    <th className="whitespace-nowrap p-2 text-left">ประเภท</th>
                    <th className="whitespace-nowrap p-2 text-left">เลขที่เอกสาร</th>
                    <th className="whitespace-nowrap p-2 text-left">สาขา</th>
                    <th className="whitespace-nowrap p-2 text-left">คู่ค้า</th>
                    <th className="whitespace-nowrap p-2 text-left">สินค้า / เต๋า</th>
                    <th className="whitespace-nowrap p-2 text-right">น้ำหนักสุทธิ</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDrafts.map((draft) => (
                    <tr className="border-b border-slate-100 last:border-b-0" key={`${draft.drafterName}:${draft.documentNo}:${draft.savedAt}:${draft.type}:${draft.branchId}`}>
                      <td className="min-w-[15rem] px-3 py-3">
                        <div className="font-medium text-slate-900">{draft.drafterName}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                          <span className="font-medium text-blue-700">เพิ่งบันทึกร่าง: {draft.activityDescription || activityDetailLabel(draft.activityDetail)}</span>
                          <span className="text-slate-500">· {formatSavedAt(draft.savedAt)}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">{typeLabel(draft.type)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">{documentLabel(draft)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">{draft.branchName}</td>
                      <td className="max-w-[16rem] truncate px-3 py-3 text-slate-900">{draft.partyName || '-'}</td>
                      <td className="max-w-[22rem] px-3 py-3 text-slate-900">
                        <div className="truncate">{productSummary(draft)}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{draft.lineCount.toLocaleString('th-TH')} รายการ · น้ำหนักรวม {formatWeight(draft.grossWeight)} กก.</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums text-slate-900">{formatWeight(draft.netWeight)} กก.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {visibleDrafts.map((draft) => (
              <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm" key={`${draft.drafterName}:${draft.documentNo}:${draft.savedAt}:${draft.type}:${draft.branchId}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{draft.drafterName}</div>
                    <div className="mt-0.5 text-xs font-medium text-blue-700">เพิ่งบันทึกร่าง: {draft.activityDescription || activityDetailLabel(draft.activityDetail)}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{typeLabel(draft.type)} · {documentLabel(draft)} · {draft.branchName}</div>
                  </div>
                  <span className="whitespace-nowrap text-xs text-slate-500">{formatSavedAt(draft.savedAt)}</span>
                </div>
                <div className="space-y-1.5 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
                  <div><span className="font-medium text-slate-500">คู่ค้า: </span><span className="text-slate-900">{draft.partyName || '-'}</span></div>
                  <div><span className="font-medium text-slate-500">สินค้า: </span><span className="text-slate-900">{productSummary(draft)}</span></div>
                  <div><span className="font-medium text-slate-500">รายการ/เต๋า: </span><span className="text-slate-900">{draft.lineCount.toLocaleString('th-TH')} รายการ</span></div>
                </div>
                <div className="flex items-end justify-between border-t border-slate-100 pt-2.5">
                  <span className="text-xs text-slate-500">น้ำหนักรวม {formatWeight(draft.grossWeight)} กก.</span>
                  <div className="text-right"><span className="block text-xs text-slate-500">น้ำหนักสุทธิ</span><span className="text-base font-bold tabular-nums text-emerald-700">{formatWeight(draft.netWeight)} กก.</span></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
