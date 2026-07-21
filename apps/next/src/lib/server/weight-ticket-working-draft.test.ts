import { describe, expect, it, vi } from 'vitest'

import {
  removeWeightTicketWorkingDraftOrThrow,
  WeightTicketWorkingDraftConflictError,
  weightTicketWorkingDraftCleanupFromRequest,
} from './weight-ticket-working-draft'
import { WEIGHT_TICKET_WORKING_DRAFT_HEADER } from '@/lib/weight-ticket-drafts'

const cleanup = { revision: 3, scopeKey: 'new:WTI' }
const appUserId = 47n

function requestWithCleanup(value: unknown) {
  return new Request('http://localhost/api/daily/weight-tickets', {
    headers: { [WEIGHT_TICKET_WORKING_DRAFT_HEADER]: JSON.stringify(value) },
    method: 'POST',
  })
}

describe('weight ticket working-draft finalization', () => {
  it('accepts only the expected form scope', () => {
    expect(weightTicketWorkingDraftCleanupFromRequest(requestWithCleanup(cleanup), 'new:WTI')).toEqual(cleanup)
    expect(() => weightTicketWorkingDraftCleanupFromRequest(requestWithCleanup(cleanup), 'new:WTO')).toThrow('แบบร่างที่ใช้ปิดงานไม่ตรง')
  })

  it('deletes only the exact snapshot revision in the document transaction', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 })
    const findFirst = vi.fn()
    const tx = { weight_ticket_form_drafts: { deleteMany, findFirst } } as never

    await removeWeightTicketWorkingDraftOrThrow(tx, appUserId, cleanup)

    expect(deleteMany).toHaveBeenCalledWith({
      where: { app_user_id: appUserId, revision: 3, scope_key: 'new:WTI' },
    })
    expect(findFirst).not.toHaveBeenCalled()
  })

  it('rolls back the real document write instead of deleting a newer snapshot', async () => {
    const tx = {
      weight_ticket_form_drafts: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue({ revision: 4 }),
      },
    } as never

    await expect(removeWeightTicketWorkingDraftOrThrow(tx, appUserId, cleanup)).rejects.toBeInstanceOf(WeightTicketWorkingDraftConflictError)
  })
})
