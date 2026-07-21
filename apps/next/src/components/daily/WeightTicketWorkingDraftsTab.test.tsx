// @vitest-environment jsdom

import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WeightTicketTeamDraft } from '@/lib/weight-ticket-drafts'
import { WeightTicketWorkingDraftsTab } from './WeightTicketWorkingDraftsTab'

const mocks = vi.hoisted(() => ({
  getWeightTicketTeamDrafts: vi.fn(),
}))

vi.mock('@/lib/weight-ticket-drafts', () => ({
  getWeightTicketTeamDrafts: mocks.getWeightTicketTeamDrafts,
}))

vi.mock('@/lib/weight-tickets', () => ({
  formatWeight: (weight: number) => weight.toLocaleString('th-TH'),
}))

const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
const previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT

const teamDraft: WeightTicketTeamDraft = {
  activity: 'weight',
  activityDetail: 'weight',
  activityDescription: 'แก้น้ำหนักชั่ง — เหล็ก · 120 กก.',
  branchId: 'BR-001',
  branchName: 'สำนักงานใหญ่',
  documentNo: 'WTI2607-0001',
  drafterName: 'สมชาย ผู้ร่าง',
  grossWeight: 120,
  lineCount: 1,
  netWeight: 115,
  otherProductCount: 0,
  partyName: 'ผู้ขายทดสอบ',
  productNames: ['เหล็ก'],
  savedAt: '2026-07-21T04:00:00.000Z',
  type: 'WTI',
}

describe('WeightTicketWorkingDraftsTab', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    vi.useFakeTimers()
    vi.clearAllMocks()
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.useRealTimers()
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment
  })

  it('clears stale shared drafts when a later refresh fails', async () => {
    mocks.getWeightTicketTeamDrafts
      .mockResolvedValueOnce({ drafts: [teamDraft], truncated: false })
      .mockRejectedValueOnce(new Error('forbidden'))

    await act(async () => {
      root.render(<WeightTicketWorkingDraftsTab branchCode="all" />)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('สมชาย ผู้ร่าง')
    expect(container.textContent).toContain('WTI2607-0001')
    expect(container.textContent).toContain('เพิ่งบันทึกร่าง: แก้น้ำหนักชั่ง — เหล็ก · 120 กก.')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })

    expect(container.textContent).not.toContain('สมชาย ผู้ร่าง')
    expect(container.textContent).toContain('ไม่สามารถโหลดแบบร่างล่าสุดได้')
  })

  it('aborts an in-flight refresh while the tab is hidden', async () => {
    let requestSignal: AbortSignal | undefined
    mocks.getWeightTicketTeamDrafts.mockImplementation((options?: { signal?: AbortSignal }) => {
      requestSignal = options?.signal
      return new Promise(() => undefined)
    })

    await act(async () => {
      root.render(<WeightTicketWorkingDraftsTab branchCode="all" />)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(requestSignal?.aborted).toBe(false)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(requestSignal?.aborted).toBe(true)
  })
})
