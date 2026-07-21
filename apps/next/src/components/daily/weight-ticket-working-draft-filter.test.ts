import { describe, expect, it } from 'vitest'

import type { WeightTicketTeamDraft } from '@/lib/weight-ticket-drafts'
import {
  filterWeightTicketWorkingDrafts,
  refreshSelectedWeightTicketWorkingDraft,
} from './weight-ticket-working-draft-filter'

const draft: WeightTicketTeamDraft = {
  activity: 'lot',
  activityDetail: 'lot-added',
  activityDescription: 'เพิ่มเต๋าชั่ง — กระทะดำ, ผัด',
  branchId: 'BR-001',
  branchName: 'สมุทรสาคร',
  containerDeductionWeight: 0,
  deductionWeight: 0,
  documentNo: '',
  drafterName: 'สมชาย',
  draftKey: 'a'.repeat(64),
  grossWeight: 20,
  lineCount: 2,
  netWeight: 20,
  otherProductCount: 0,
  partyName: 'ผู้ขายทดสอบ',
  productNames: ['กระทะดำ, ผัด'],
  savedAt: '2026-07-21T04:00:00.000Z',
  type: 'WTI',
}

describe('filterWeightTicketWorkingDrafts', () => {
  it('keeps matching drafts in the same WTI/WTO table filters', () => {
    expect(filterWeightTicketWorkingDrafts([draft], {
      branchCode: 'BR-001',
      dateFrom: '2026-07-21',
      dateTo: '2026-07-21',
      query: 'สมชาย',
      status: [],
      type: 'WTI',
    })).toEqual([draft])
  })

  it('hides working drafts when a non-draft status is selected', () => {
    expect(filterWeightTicketWorkingDrafts([draft], {
      branchCode: null,
      dateFrom: '',
      dateTo: '',
      query: '',
      status: ['received'],
      type: 'WTI',
    })).toEqual([])
  })

  it('refreshes an open detail from the same polling result without another request', () => {
    const latest = { ...draft, branchId: 'BR-002', branchName: 'สาขาใหม่', drafterName: 'ชื่อใหม่', netWeight: 25, savedAt: '2026-07-21T04:00:03.000Z' }
    const sameLabelsDifferentDraft = { ...latest, draftKey: 'b'.repeat(64) }

    expect(refreshSelectedWeightTicketWorkingDraft(draft, [sameLabelsDifferentDraft, latest])).toEqual(latest)
    expect(refreshSelectedWeightTicketWorkingDraft(draft, [])).toBeNull()
  })
})
