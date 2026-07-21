import { describe, expect, it, vi } from 'vitest'

import {
  deriveWeightTicketWorkingDraftLastChange,
  describeWeightTicketWorkingDraftLastChange,
  hasWeightTicketWorkingDraftContent,
  isWeightTicketWorkingDraftNewerThanDocument,
  WeightTicketDraftDebounce,
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

    expect(weightTicketFormDraftPayloadSchema.parse(payload).activity).toBe('document')
    expect(weightTicketFormDraftPayloadSchema.parse(payload).activityDetail).toBe('document')
    expect(weightTicketFormDraftPayloadSchema.parse({ ...payload, activity: 'weight' }).activity).toBe('weight')
    expect(weightTicketFormDraftPayloadSchema.parse({ ...payload, activityDetail: 'lot-added' }).activityDetail).toBe('lot-added')
    expect(weightTicketFormDraftPayloadSchema.safeParse({ ...payload, activity: 'raw field name' }).success).toBe(false)
    expect(weightTicketFormDraftPayloadSchema.safeParse({ ...payload, activityDetail: 'raw field name' }).success).toBe(false)
    expect(weightTicketFormSchema.safeParse(payload).success).toBe(false)
  })

  it('derives the visible activity from the saved snapshots instead of client-provided activity', () => {
    const before = weightTicketFormDraftPayloadSchema.parse({
      branchId: 'BR01',
      godownName: '',
      lines: [{
        containerDeductionWeight: '',
        deductionMode: 'none',
        deductionValue: '',
        grossWeight: '100',
        id: 'lot-1',
        imageNames: [],
        impurityId: '',
        impurityProductId: '',
        note: '',
        productId: 'SCRAP-01',
        productName: 'ทองแดง',
        warehouseId: 'FG-01',
        warehouseName: 'FG หลัก',
      }],
      partyId: '',
      remark: '',
      type: 'WTI',
      vehicleImageNames: [],
      vehicleNo: '',
    })
    const next = weightTicketFormDraftPayloadSchema.parse({
      ...before,
      activity: 'remark',
      activityDetail: 'remark',
      branchId: 'BR01',
      godownName: '',
      lines: [{
        containerDeductionWeight: '',
        deductionMode: 'none',
        deductionValue: '',
        grossWeight: '125.5',
        id: 'lot-1',
        imageNames: [],
        impurityId: '',
        impurityProductId: '',
        note: '',
        productId: 'SCRAP-01',
        productName: 'ทองแดง',
        warehouseId: 'FG-01',
        warehouseName: 'FG หลัก',
      }],
      partyId: '',
      remark: '',
      type: 'WTI',
      vehicleImageNames: [],
      vehicleNo: '',
    })

    const change = deriveWeightTicketWorkingDraftLastChange(before, next)
    expect(change).toEqual({ grossWeightKg: 125.5, kind: 'weight', productId: 'SCRAP-01', productName: 'ทองแดง' })
    expect(describeWeightTicketWorkingDraftLastChange(change)).toBe('แก้น้ำหนักชั่ง — ทองแดง · 125.5 กก.')
    expect(describeWeightTicketWorkingDraftLastChange({ kind: 'remark' })).toBe('แก้ไขหมายเหตุ')
    expect(describeWeightTicketWorkingDraftLastChange({ kind: 'attachment' })).toBe('แนบหรือแก้ไขรูปภาพ')

    const beforeRemoval = weightTicketFormDraftPayloadSchema.parse({
      ...before,
      lines: [...before.lines, {
        ...before.lines[0],
        id: 'line-2',
        productId: 'SCRAP-02',
        productName: 'อะลูมิเนียม',
      }],
    })
    const afterRemoval = weightTicketFormDraftPayloadSchema.parse({ ...beforeRemoval, lines: before.lines })
    expect(deriveWeightTicketWorkingDraftLastChange(beforeRemoval, afterRemoval)).toEqual({ kind: 'line-removed', productId: 'SCRAP-02', productName: 'อะลูมิเนียม' })
  })

  it('caps a team activity description at the response contract length', () => {
    const description = describeWeightTicketWorkingDraftLastChange({
      kind: 'warehouse',
      productName: 'ก'.repeat(240),
      warehouseName: 'ข'.repeat(160),
    })

    expect(description.length).toBeLessThanOrEqual(240)
  })

  it('recognizes only user-entered values as working-draft content', () => {
    const emptyPayload = weightTicketFormDraftPayloadSchema.parse({
      branchId: '',
      godownName: '',
      lines: [{
        containerDeductionWeight: '',
        deductionMode: 'none',
        deductionValue: '',
        grossWeight: '',
        id: 'lot-1',
        imageNames: [],
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
    })
    const imageReference = JSON.stringify({
      fileName: 'lot.jpg',
      storageKey: 'attachments/pending/lot.jpg',
      url: 'https://example.supabase.co/storage/v1/object/public/weight-ticket-pdfs/attachments/pending/lot.jpg',
    })

    expect(hasWeightTicketWorkingDraftContent(emptyPayload)).toBe(false)
    expect(hasWeightTicketWorkingDraftContent({ ...emptyPayload, branchId: 'BR01' })).toBe(true)
    expect(hasWeightTicketWorkingDraftContent({ ...emptyPayload, partyId: 'SUP-01' })).toBe(true)
    expect(hasWeightTicketWorkingDraftContent({ ...emptyPayload, remark: 'ตรวจรับ' })).toBe(true)
    expect(hasWeightTicketWorkingDraftContent({ ...emptyPayload, vehicleNo: '1กข 1234' })).toBe(true)
    expect(hasWeightTicketWorkingDraftContent({ ...emptyPayload, vehicleImageNames: [imageReference] })).toBe(true)
    expect(hasWeightTicketWorkingDraftContent({ ...emptyPayload, godownName: 'ลานหลัก' })).toBe(true)
    expect(hasWeightTicketWorkingDraftContent({
      ...emptyPayload,
      lines: [{ ...emptyPayload.lines[0], imageNames: [imageReference] }],
    })).toBe(true)
    expect(hasWeightTicketWorkingDraftContent({
      ...emptyPayload,
      lines: [{ ...emptyPayload.lines[0], productId: 'SCRAP-01' }],
    })).toBe(true)
    expect(hasWeightTicketWorkingDraftContent({
      ...emptyPayload,
      lines: [{ ...emptyPayload.lines[0], grossWeight: '0' }],
    })).toBe(true)
    expect(hasWeightTicketWorkingDraftContent({
      ...emptyPayload,
      lines: [{ ...emptyPayload.lines[0], containerDeductionWeight: '0' }],
    })).toBe(true)
    expect(hasWeightTicketWorkingDraftContent({
      ...emptyPayload,
      lines: [{ ...emptyPayload.lines[0], deductionValue: '0' }],
    })).toBe(true)
    expect(hasWeightTicketWorkingDraftContent({
      ...emptyPayload,
      lines: [{ ...emptyPayload.lines[0], note: 'ตรวจสอบ' }],
    })).toBe(true)
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

describe('weight ticket working-draft debounce', () => {
  it('does not run a pending autosave after a real document save cancels it', () => {
    vi.useFakeTimers()
    try {
      const callback = vi.fn()
      const debounce = new WeightTicketDraftDebounce()

      debounce.schedule(callback, 800)
      debounce.cancel()
      vi.advanceTimersByTime(800)

      expect(callback).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
