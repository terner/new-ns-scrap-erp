// @vitest-environment jsdom

import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WeightTicketTeamDraft } from '@/lib/weight-ticket-drafts'
import {
  WeightTicketWorkingDraftDetailDialog,
  WeightTicketWorkingDraftDesktopRow,
  WeightTicketWorkingDraftMobileCard,
} from './WeightTicketWorkingDraftRows'

vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({ children, open }: React.PropsWithChildren<{ open?: boolean }>) => open ? <>{children}</> : null,
  DialogContent: ({ children }: React.PropsWithChildren) => <div role="dialog">{children}</div>,
  DialogDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  DialogFooter: ({ children }: React.PropsWithChildren) => <footer>{children}</footer>,
  DialogHeader: ({ children }: React.PropsWithChildren) => <header>{children}</header>,
  DialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
}))

const draft: WeightTicketTeamDraft = {
  activity: 'weight',
  activityDetail: 'weight',
  activityDescription: 'แก้น้ำหนักชั่ง — เหล็ก · 120 กก.',
  branchId: 'BR-001',
  branchName: 'สำนักงานใหญ่',
  containerDeductionWeight: 5,
  deductionWeight: 2,
  documentNo: '',
  drafterName: 'สมชาย ผู้ร่าง',
  draftKey: 'a'.repeat(64),
  grossWeight: 120,
  lineCount: 2,
  netWeight: 113,
  otherProductCount: 1,
  partyName: 'ผู้ขายทดสอบ',
  productNames: ['เหล็ก', 'ทองแดง'],
  savedAt: '2026-07-21T04:00:00.000Z',
  type: 'WTI',
}

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT

describe('WeightTicketWorkingDraftRows', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
  })

  it('opens the read-only detail from desktop and mobile draft rows', () => {
    const onOpen = vi.fn()

    act(() => root.render(
      <>
        <table><tbody><WeightTicketWorkingDraftDesktopRow draft={draft} onOpen={onOpen} typeFilter="WTI" /></tbody></table>
        <WeightTicketWorkingDraftMobileCard draft={draft} onOpen={onOpen} typeFilter="WTI" />
      </>,
    ))

    const desktopRow = container.querySelector('tr[data-working-draft-row="true"]') as HTMLTableRowElement
    const desktopAction = desktopRow.querySelector('button[aria-label^="ดูรายละเอียดร่าง"]') as HTMLButtonElement
    const mobileCard = container.querySelector('button[data-working-draft-row="true"]') as HTMLButtonElement
    act(() => desktopRow.click())
    act(() => desktopAction.click())
    act(() => mobileCard.click())

    expect(onOpen).toHaveBeenNthCalledWith(1, draft)
    expect(onOpen).toHaveBeenNthCalledWith(2, draft)
    expect(onOpen).toHaveBeenNthCalledWith(3, draft)
    expect(desktopAction.getAttribute('aria-label')).toContain('ดูรายละเอียดร่าง')
  })

  it('shows the latest safe snapshot and only closes through its visible close action', () => {
    const onClose = vi.fn()

    act(() => root.render(<WeightTicketWorkingDraftDetailDialog draft={draft} onClose={onClose} />))

    expect(container.textContent).toContain('รายละเอียดร่าง ร่างใหม่')
    expect(container.textContent).toContain('สมชาย ผู้ร่าง')
    expect(container.textContent).toContain('ผู้ขายทดสอบ')
    expect(container.textContent).toContain('สำนักงานใหญ่')
    expect(container.textContent).toContain('เหล็ก · ทองแดง และอีก 1 สินค้า')
    expect(container.textContent).toContain('น้ำหนักรวม')
    expect(container.textContent).toContain('120.00 กก.')
    expect(container.textContent).toContain('หักภาชนะ')
    expect(container.textContent).toContain('5.00 กก.')
    expect(container.textContent).toContain('หักสิ่งเจือปน')
    expect(container.textContent).toContain('2.00 กก.')
    expect(container.textContent).toContain('น้ำหนักสุทธิ')
    expect(container.textContent).toContain('113.00 กก.')
    expect(container.textContent).toContain('แก้น้ำหนักชั่ง — เหล็ก · 120 กก.')

    const closeButtons = [...container.querySelectorAll('button')].filter((button) => button.textContent === 'ปิด')
    expect(closeButtons).toHaveLength(1)
    act(() => closeButtons[0].click())
    expect(onClose).toHaveBeenCalledOnce()
  })
})
