import { randomUUID } from 'node:crypto'
import { Prisma } from '../../../generated/prisma/client'
import { prisma } from '@/lib/server/prisma'
import { notifyWeightTicketLine } from '@/lib/server/weight-ticket-line-notification'

type EnqueueOptions = {
  customMessage?: string
  force?: boolean
  requestedBy: string
  targetId?: string
}

type ExecuteOptions = {
  force?: boolean
}

type JobRef = {
  id: bigint
}

function toBigIntId(value: bigint | number | string) {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') return BigInt(value)
  return BigInt(value.trim())
}

async function resolveWeightTicket(documentNoOrId: string) {
  const trimmed = documentNoOrId.trim()
  const numericId = /^\d+$/.test(trimmed) ? BigInt(trimmed) : null
  return prisma.weight_tickets.findFirst({
    select: {
      branches: { select: { code: true } },
      doc_no: true,
      doc_type: true,
      id: true,
    },
    where: numericId != null
      ? { OR: [{ id: numericId }, { doc_no: trimmed }] }
      : { doc_no: trimmed },
  })
}

async function resolveTargets(ticket: Awaited<ReturnType<typeof resolveWeightTicket>>, targetId?: string) {
  if (!ticket) return []
  const requestedTargetId = targetId?.trim()
  if (requestedTargetId && requestedTargetId !== 'routing') {
    const existing = await prisma.line_targets.findUnique({
      select: { target_id: true, target_type: true },
      where: { target_id: requestedTargetId },
    })
    return [{
      target_id: requestedTargetId,
      target_type: existing?.target_type ?? 'unknown',
    }]
  }

  const isWti = ticket.doc_type === 'WTI'
  const targets = await prisma.line_targets.findMany({
    orderBy: [{ is_default: 'desc' }, { display_name: 'asc' }],
    select: { target_id: true, target_type: true },
    where: {
      is_active: true,
      notify_wti: isWti ? true : undefined,
      notify_wto: isWti ? undefined : true,
      OR: [
        { branch_code: null },
        { branch_code: '' },
        { branch_code: ticket.branches?.code ?? '' },
      ],
    },
  })

  return targets
}

async function upsertPendingJob(input: {
  customMessage?: string
  documentNo: string
  documentType: string
  force?: boolean
  requestedBy: string
  sourceId: bigint
  targetId: string
  targetType: string
}) {
  const existing = await prisma.line_notification_jobs.findFirst({
    select: { id: true },
    where: {
      source_type: 'weight_ticket',
      source_id: input.sourceId,
      target_id: input.targetId,
      status: { in: ['pending', 'processing'] },
    },
  })

  if (existing) {
    if (input.force) {
      return prisma.line_notification_jobs.update({
        select: { id: true },
        where: { id: existing.id },
        data: {
          attempt_count: 0,
          custom_message: input.customMessage ?? null,
          last_error_code: null,
          last_error_message: null,
          locked_at: null,
          locked_by: null,
          next_retry_at: new Date(),
          requested_by: input.requestedBy,
          retry_key: randomUUID(),
          status: 'pending',
          updated_at: new Date(),
        },
      })
    }
    return existing
  }

  try {
    return await prisma.line_notification_jobs.create({
      select: { id: true },
      data: {
        custom_message: input.customMessage ?? null,
        document_no: input.documentNo,
        document_type: input.documentType,
        next_retry_at: new Date(),
        requested_by: input.requestedBy,
        retry_key: randomUUID(),
        source_id: input.sourceId,
        source_type: 'weight_ticket',
        status: 'pending',
        target_id: input.targetId,
        target_type: input.targetType,
      },
    })
  } catch (caught) {
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002') {
      const pending = await prisma.line_notification_jobs.findFirst({
        select: { id: true },
        where: {
          source_type: 'weight_ticket',
          source_id: input.sourceId,
          target_id: input.targetId,
          status: { in: ['pending', 'processing'] },
        },
      })
      if (pending) return pending
    }
    throw caught
  }
}

export async function enqueueNotificationJob(documentNoOrId: string, options: EnqueueOptions) {
  const ticket = await resolveWeightTicket(documentNoOrId)
  if (!ticket) {
    return {
      status: 'no_targets' as const,
      message: `ไม่พบใบรับ-ส่งของ ${documentNoOrId}`,
      jobs: [] as JobRef[],
    }
  }

  const targets = await resolveTargets(ticket, options.targetId)
  if (targets.length === 0) {
    return {
      status: 'no_targets' as const,
      message: 'ไม่พบ LINE target ที่ active และตรงกับสาขา/ประเภทเอกสาร',
      jobs: [] as JobRef[],
    }
  }

  const jobs = await Promise.all(targets.map((target) => upsertPendingJob({
    customMessage: options.customMessage,
    documentNo: ticket.doc_no,
    documentType: ticket.doc_type,
    force: options.force,
    requestedBy: options.requestedBy,
    sourceId: ticket.id,
    targetId: target.target_id,
    targetType: target.target_type,
  })))

  return {
    status: 'queued' as const,
    jobs,
  }
}

export async function executeNotificationJob(jobId: bigint | number | string, options: ExecuteOptions = {}) {
  const id = toBigIntId(jobId)
  const lockedAt = new Date()
  const lockedBy = 'next-api'
  const job = await prisma.line_notification_jobs.update({
    where: { id },
    data: {
      locked_at: lockedAt,
      locked_by: lockedBy,
      status: 'processing',
      updated_at: lockedAt,
    },
  })

  const startedAt = Date.now()
  const attemptNo = job.attempt_count + 1

  try {
    const result = await notifyWeightTicketLine(job.document_no, {
      customMessage: job.custom_message ?? undefined,
      force: options.force,
      origin: process.env.NEXT_PUBLIC_APP_URL || '',
      requestedBy: job.requested_by ?? 'line_notification_job',
      retryKey: String(job.retry_key),
      scopedBranchIds: [],
      targetId: job.target_id,
    })

    const sent = result.code === 'SENT'
    const skipped = result.code === 'ALREADY_SENT'
    const nextStatus = sent ? 'sent' : skipped ? 'skipped' : 'failed'
    const finishedAt = new Date()
    const errorMessage = sent || skipped ? null : result.error ?? 'ส่ง LINE ไม่สำเร็จ'

    await prisma.line_notification_jobs.update({
      where: { id },
      data: {
        attempt_count: attemptNo,
        last_error_code: errorMessage ? result.code : null,
        last_error_message: errorMessage,
        line_request_id: result.lineRequestId ?? null,
        pdf_url: result.pdfUrl ?? null,
        sent_at: sent || skipped ? finishedAt : null,
        status: nextStatus,
        updated_at: finishedAt,
      },
    })

    await prisma.line_notification_attempts.create({
      data: {
        attempt_no: attemptNo,
        duration_ms: Date.now() - startedAt,
        error_code: errorMessage ? result.code : null,
        error_message: errorMessage,
        job_id: id,
        line_request_id: result.lineRequestId ?? null,
        status: nextStatus,
      },
    })

    return {
      status: nextStatus as 'sent' | 'skipped' | 'failed',
      error: errorMessage ?? undefined,
      lineRequestId: result.lineRequestId ?? undefined,
      pdfUrl: result.pdfUrl ?? undefined,
    }
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : 'ส่ง LINE ไม่สำเร็จ'
    const finishedAt = new Date()
    await prisma.line_notification_jobs.update({
      where: { id },
      data: {
        attempt_count: attemptNo,
        last_error_code: 'EXECUTE_FAILED',
        last_error_message: error,
        next_retry_at: new Date(Date.now() + 60_000),
        status: attemptNo >= job.max_attempts ? 'failed' : 'pending',
        updated_at: finishedAt,
      },
    })
    await prisma.line_notification_attempts.create({
      data: {
        attempt_no: attemptNo,
        duration_ms: Date.now() - startedAt,
        error_code: 'EXECUTE_FAILED',
        error_message: error,
        job_id: id,
        status: 'failed',
      },
    })
    return {
      status: 'failed' as const,
      error,
    }
  }
}
