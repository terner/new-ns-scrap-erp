import type { Prisma } from '../../../generated/prisma/client'

import {
  WEIGHT_TICKET_WORKING_DRAFT_HEADER,
  weightTicketFormDraftDeleteSchema,
  type WeightTicketWorkingDraftCleanup,
} from '@/lib/weight-ticket-drafts'

export class WeightTicketWorkingDraftConflictError extends Error {
  constructor() {
    super('แบบร่างถูกแก้ไขจากอีกหน้าต่าง กรุณาโหลดฉบับล่าสุดก่อนบันทึกเอกสาร')
    this.name = 'WeightTicketWorkingDraftConflictError'
  }
}

export function weightTicketWorkingDraftCleanupFromRequest(request: Request, expectedScopeKey: string): WeightTicketWorkingDraftCleanup | null {
  const rawValue = request.headers.get(WEIGHT_TICKET_WORKING_DRAFT_HEADER)
  if (!rawValue) return null

  const cleanup = weightTicketFormDraftDeleteSchema.parse(JSON.parse(rawValue))
  if (cleanup.scopeKey !== expectedScopeKey) {
    throw new Error('แบบร่างที่ใช้ปิดงานไม่ตรงกับเอกสารที่กำลังบันทึก')
  }
  return cleanup
}

export async function removeWeightTicketWorkingDraftOrThrow(
  tx: Prisma.TransactionClient,
  appUserId: bigint,
  cleanup: WeightTicketWorkingDraftCleanup | null,
) {
  if (!cleanup) return

  const deleted = await tx.weight_ticket_form_drafts.deleteMany({
    where: {
      app_user_id: appUserId,
      revision: cleanup.revision,
      scope_key: cleanup.scopeKey,
    },
  })
  if (deleted.count > 0) return

  const current = await tx.weight_ticket_form_drafts.findFirst({
    select: { revision: true },
    where: {
      app_user_id: appUserId,
      scope_key: cleanup.scopeKey,
    },
  })
  if (current) throw new WeightTicketWorkingDraftConflictError()
}
