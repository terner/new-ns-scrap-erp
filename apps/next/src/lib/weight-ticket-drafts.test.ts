import { describe, expect, it, vi } from 'vitest'

import {
  isWeightTicketWorkingDraftNewerThanDocument,
  WeightTicketDraftAutosaveQueue,
  weightTicketFormDraftPayloadSchema,
  weightTicketFormDraftWriteSchema,
} from './weight-ticket-drafts'
import { weightTicketFormSchema } from './weight-tickets'

describe('weight ticket working-draft schema', () => {
  it('keeps a newly added empty lot while the final document schema remains strict', () => {
    const payload = {
      branchId: 'BR01',
      godownName: '',
      lines: [
        {
          containerDeductionWeight: '',
          deductionMode: 'none',
          deductionValue: '',
          grossWeight: '',
          id: 'lot-1',
          imageNames: [],
          impurityId: '',
          impurityProductId: '',
          note: '',
          productId: 'SCRAP-01',
          warehouseId: '',
        },
        {
          containerDeductionWeight: '',
          deductionMode: 'none',
          deductionValue: '',
          grossWeight: '',
          id: 'lot-2',
          imageNames: [],
          impurityId: '',
          impurityProductId: '',
          note: '',
          parentId: 'lot-1',
          productId: 'SCRAP-01',
          warehouseId: '',
        },
      ],
      partyId: '',
      remark: '',
      type: 'WTI',
      vehicleImageNames: [],
      vehicleNo: '',
    }

    expect(weightTicketFormDraftPayloadSchema.safeParse(payload).success).toBe(true)
    expect(weightTicketFormSchema.safeParse(payload).success).toBe(false)
  })

  it('stores only uploaded image references, never inline image data', () => {
    const payload = {
      branchId: '',
      godownName: '',
      lines: [{
        containerDeductionWeight: '',
        deductionMode: 'none',
        deductionValue: '',
        grossWeight: '',
        id: 'lot-1',
        imageNames: [JSON.stringify({
          fileName: 'lot.jpg',
          storageKey: 'attachments/pending/2026-07-21/lot.jpg',
          url: 'https://example.supabase.co/storage/v1/object/public/weight-ticket-pdfs/attachments/pending/2026-07-21/lot.jpg',
        })],
        impurityId: '',
        impurityProductId: '',
        note: '',
        productId: '',
        warehouseId: '',
      }],
      partyId: '',
      remark: '',
      type: 'WTI',
      vehicleImageNames: [],
      vehicleNo: '',
    }

    expect(weightTicketFormDraftPayloadSchema.safeParse(payload).success).toBe(true)
    expect(weightTicketFormDraftPayloadSchema.safeParse({
      ...payload,
      vehicleImageNames: [JSON.stringify({ fileName: 'legacy.jpg', dataUrl: 'data:image/jpeg;base64,AA==' })],
    }).success).toBe(false)
    expect(weightTicketFormDraftWriteSchema.safeParse({
      payload,
      revision: 0,
      scopeKey: 'new:WTO',
    }).success).toBe(false)
  })

  it('keeps every added lot that fits the payload-size limit', () => {
    const lines = Array.from({ length: 51 }, (_, index) => ({
      containerDeductionWeight: '',
      deductionMode: 'none' as const,
      deductionValue: '',
      grossWeight: '',
      id: `lot-${index + 1}`,
      imageNames: [],
      impurityId: '',
      impurityProductId: '',
      note: '',
      productId: 'SCRAP-01',
      warehouseId: '',
    }))

    expect(weightTicketFormDraftPayloadSchema.safeParse({
      branchId: '',
      godownName: '',
      lines,
      partyId: '',
      remark: '',
      type: 'WTI',
      vehicleImageNames: [],
      vehicleNo: '',
    }).success).toBe(true)
  })
})

describe('weight ticket working-draft queue', () => {
  it('serializes saves so a newer snapshot is saved after an in-flight request', async () => {
    const save = vi.fn()
      .mockResolvedValueOnce({ revision: 1, savedAt: '2026-07-21T10:00:00.000Z' })
      .mockResolvedValueOnce({ revision: 2, savedAt: '2026-07-21T10:00:01.000Z' })
    const queue = new WeightTicketDraftAutosaveQueue(save)

    queue.enqueue({ value: 'first' })
    queue.enqueue({ value: 'latest' })
    await queue.flush()

    expect(save).toHaveBeenNthCalledWith(1, { value: 'first' }, 0)
    expect(save).toHaveBeenNthCalledWith(2, { value: 'latest' }, 1)
    expect(queue.revision).toBe(2)
  })

  it('does not lose the newest pending snapshot after an earlier save fails', async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ revision: 1, savedAt: '2026-07-21T10:00:00.000Z' })
    const queue = new WeightTicketDraftAutosaveQueue(save)

    const firstSave = queue.enqueue({ value: 'first' })
    queue.enqueue({ value: 'latest' })
    await expect(firstSave).rejects.toThrow('offline')
    await queue.flush()

    expect(save).toHaveBeenNthCalledWith(1, { value: 'first' }, 0)
    expect(save).toHaveBeenNthCalledWith(2, { value: 'latest' }, 0)
    expect(queue.revision).toBe(1)
  })

  it('restores an edit draft only when it is newer than the real document', () => {
    expect(isWeightTicketWorkingDraftNewerThanDocument(
      '2026-07-21T10:01:00.000Z',
      null,
      '2026-07-21T10:00:00.000Z',
    )).toBe(true)
    expect(isWeightTicketWorkingDraftNewerThanDocument(
      '2026-07-21T09:59:00.000Z',
      null,
      '2026-07-21T10:00:00.000Z',
    )).toBe(false)
    expect(isWeightTicketWorkingDraftNewerThanDocument(
      'not-a-date',
      null,
      '2026-07-21T10:00:00.000Z',
    )).toBe(false)
  })
})
