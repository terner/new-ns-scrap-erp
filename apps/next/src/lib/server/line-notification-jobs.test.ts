import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  createAttempt: vi.fn(),
  createJob: vi.fn(),
  findExistingJob: vi.fn(),
  findJob: vi.fn(),
  findSetting: vi.fn(),
  findTarget: vi.fn(),
  transaction: vi.fn(),
  updateJob: vi.fn(),
}))

const credentialLock = vi.hoisted(() => ({
  read: vi.fn(),
}))

const paymentLine = vi.hoisted(() => ({
  load: vi.fn(),
  notify: vi.fn(),
}))

const receiptLine = vi.hoisted(() => ({
  load: vi.fn(),
  notify: vi.fn(),
}))

const routing = vi.hoisted(() => ({
  resolveDocument: vi.fn(),
}))

vi.mock('./prisma', () => ({
  prisma: {
    $transaction: db.transaction,
    line_notification_attempts: { create: db.createAttempt },
    line_notification_jobs: {
      create: db.createJob,
      findFirst: db.findExistingJob,
      findUnique: db.findJob,
      update: db.updateJob,
    },
    line_targets: { findFirst: db.findTarget },
    system_settings: { findUnique: db.findSetting },
  },
}))

vi.mock('./line-credential-lock', () => ({
  acquireLineCredentialReadLock: credentialLock.read,
}))

vi.mock('./purchase-payment-line-notification', () => ({
  loadPurchasePaymentLineNotificationSource: paymentLine.load,
  notifyPurchasePaymentLine: paymentLine.notify,
}))

vi.mock('./customer-receipt-line-notification', () => ({
  loadCustomerReceiptLineNotificationSource: receiptLine.load,
  notifyCustomerReceiptLine: receiptLine.notify,
}))

vi.mock('./bill-line-notification', () => ({
  loadBillLineNotificationSource: vi.fn(),
  notifyBillLine: vi.fn(),
}))

vi.mock('./weight-ticket-line-notification', () => ({ notifyWeightTicketLine: vi.fn() }))
vi.mock('./weight-tickets', () => ({
  findScopedWeightTicket: vi.fn(),
  getWeightTicketUsageCounts: vi.fn(),
  mapWeightTicketRow: vi.fn(),
}))
vi.mock('./line-notification-routing', () => ({
  resolveLineTargetsForDocument: routing.resolveDocument,
  resolveLineTargetsForWeightTicket: vi.fn(),
}))

import { enqueueAndExecuteNotification, executeNotificationJob } from './line-notification-jobs'

function transactionClient() {
  return {
    line_notification_attempts: { create: db.createAttempt },
    line_notification_jobs: {
      create: db.createJob,
      findFirst: db.findExistingJob,
      findUnique: db.findJob,
      update: db.updateJob,
    },
    line_targets: { findFirst: db.findTarget },
    system_settings: { findUnique: db.findSetting },
  }
}

describe('financial LINE notification jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const job = {
      attempt_count: 0,
      custom_message: null,
      document_no: 'PMT012607-0001',
      document_type: 'PMT',
      id: 7n,
      locked_by: null,
      max_attempts: 5,
      next_retry_at: new Date(),
      requested_by: 'tester',
      retry_key: 'retry-key',
      source_id: 42n,
      source_type: 'purchase_payment',
      status: 'pending',
      target_id: 'C-PMT',
      target_type: 'group',
    }
    paymentLine.load.mockResolvedValue({
      documentType: 'PMT',
      id: 42n,
      routingDocument: { branchId: '1', partyId: 'SUP-001', type: 'PMT' },
    })
    routing.resolveDocument.mockResolvedValue([{ targetId: 'C-PMT', targetType: 'group' }])
    db.findExistingJob.mockResolvedValue(null)
    db.createJob.mockResolvedValue(job)
    db.findJob.mockResolvedValue(job)
    db.updateJob.mockResolvedValue({ ...job, attempt_count: 1 })
    db.findSetting.mockResolvedValue({ value: 'https://erp.example.com' })
    db.findTarget.mockResolvedValue({ is_active: true, target_id: 'C-PMT', target_type: 'group' })
    db.transaction.mockImplementation(async (operation: unknown) => {
      return (operation as (client: ReturnType<typeof transactionClient>) => unknown)(transactionClient())
    })
    credentialLock.read.mockResolvedValue(undefined)
    paymentLine.notify.mockResolvedValue({ lineRequestId: 'line-request', status: 200 })
    db.createAttempt.mockResolvedValue({ id: 1n })
  })

  it('uses explicit PMT routing and dispatches the queued purchase_payment source', async () => {
    const result = await enqueueAndExecuteNotification(
      { documentNo: 'PMT012607-0001', sourceType: 'purchase_payment' },
      { force: false, requestedBy: 'tester' },
    )

    expect(routing.resolveDocument).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PMT' }),
      { allowFallback: false },
    )
    expect(db.createJob).toHaveBeenCalledWith({
      data: expect.objectContaining({
        document_type: 'PMT',
        source_id: 42n,
        source_type: 'purchase_payment',
        target_id: 'C-PMT',
      }),
    })
    expect(paymentLine.notify).toHaveBeenCalledWith('PMT012607-0001', expect.objectContaining({
      origin: 'https://erp.example.com',
      targetId: 'C-PMT',
    }))
    expect(result.executionResults).toEqual([{ lineRequestId: 'line-request', pdfUrl: undefined, status: 'sent' }])
  })

  it('uses explicit RCP routing and dispatches the queued customer_receipt source', async () => {
    const job = {
      attempt_count: 0,
      custom_message: null,
      document_no: 'RCP2607-0001',
      document_type: 'RCP',
      id: 8n,
      locked_by: null,
      max_attempts: 5,
      next_retry_at: new Date(),
      requested_by: 'tester',
      retry_key: 'receipt-retry-key',
      source_id: 43n,
      source_type: 'customer_receipt',
      status: 'pending',
      target_id: 'C-RCP',
      target_type: 'group',
    }
    receiptLine.load.mockResolvedValue({
      documentType: 'RCP',
      id: 43n,
      routingDocument: { branchId: '01', customerId: 'CUS-001', partyId: 'CUS-001', type: 'RCP' },
    })
    routing.resolveDocument.mockResolvedValue([{ targetId: 'C-RCP', targetType: 'group' }])
    db.createJob.mockResolvedValue(job)
    db.findJob.mockResolvedValue(job)
    db.updateJob.mockResolvedValue({ ...job, attempt_count: 1 })
    receiptLine.notify.mockResolvedValue({ lineRequestId: 'receipt-line-request', status: 200 })

    const result = await enqueueAndExecuteNotification(
      { documentNo: 'RCP2607-0001', sourceType: 'customer_receipt' },
      { force: false, requestedBy: 'tester' },
    )

    expect(routing.resolveDocument).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'RCP' }),
      { allowFallback: false },
    )
    expect(db.createJob).toHaveBeenCalledWith({
      data: expect.objectContaining({
        document_type: 'RCP',
        source_id: 43n,
        source_type: 'customer_receipt',
        target_id: 'C-RCP',
      }),
    })
    expect(receiptLine.notify).toHaveBeenCalledWith('RCP2607-0001', expect.objectContaining({
      origin: 'https://erp.example.com',
      targetId: 'C-RCP',
    }))
    expect(result.executionResults).toEqual([{ lineRequestId: 'receipt-line-request', pdfUrl: undefined, status: 'sent' }])
  })

  it('does not resolve targets or create an enqueue until the credential lock resolves', async () => {
    let releaseLock!: () => void
    credentialLock.read
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        releaseLock = resolve
      }))
      .mockResolvedValue(undefined)

    const enqueued = enqueueAndExecuteNotification(
      { documentNo: 'PMT012607-0001', sourceType: 'purchase_payment' },
      { force: false, requestedBy: 'tester' },
    )

    await vi.waitFor(() => expect(credentialLock.read).toHaveBeenCalledTimes(1))
    expect(routing.resolveDocument).not.toHaveBeenCalled()
    expect(db.findTarget).not.toHaveBeenCalled()
    expect(db.findExistingJob).not.toHaveBeenCalled()
    expect(db.createJob).not.toHaveBeenCalled()

    releaseLock()
    await expect(enqueued).resolves.toMatchObject({ status: 'enqueued' })
  })

  it('rejects an unavailable explicit target before creating a job', async () => {
    db.findTarget.mockResolvedValue(null)

    await expect(enqueueAndExecuteNotification(
      { documentNo: 'PMT012607-0001', sourceType: 'purchase_payment' },
      { force: true, requestedBy: 'tester', targetId: 'C-OLD-OA-GROUP' },
    )).rejects.toThrow('กลุ่ม LINE นี้ไม่พร้อมใช้งาน')

    expect(db.findTarget).toHaveBeenCalledWith({
      where: { is_active: true, target_id: 'C-OLD-OA-GROUP' },
    })
    expect(db.createJob).not.toHaveBeenCalled()
    expect(paymentLine.notify).not.toHaveBeenCalled()
  })

  it('skips an existing queued job when its target is no longer active', async () => {
    db.findTarget.mockResolvedValue(null)

    await expect(executeNotificationJob('7', { force: true })).resolves.toMatchObject({
      status: 'skipped',
    })

    expect(paymentLine.notify).not.toHaveBeenCalled()
    expect(db.createAttempt).not.toHaveBeenCalled()
    expect(db.updateJob).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        last_error_code: 'TARGET_INACTIVE',
        status: 'skipped',
      }),
      where: { id: 7n },
    }))
  })

  it('holds the shared credential transaction lock until queued dispatch settles', async () => {
    let finishNotify: ((value: { lineRequestId: string; status: number }) => void) | undefined
    let transactionSettled = false
    paymentLine.notify.mockReturnValue(new Promise((resolve) => {
      finishNotify = resolve
    }))
    db.transaction.mockImplementation(async (operation: unknown) => {
      const result = await (operation as (client: ReturnType<typeof transactionClient>) => Promise<unknown>)(
        transactionClient(),
      )
      transactionSettled = true
      return result
    })

    const execution = executeNotificationJob('7')

    await vi.waitFor(() => expect(paymentLine.notify).toHaveBeenCalledOnce())
    expect(credentialLock.read).toHaveBeenCalledOnce()
    expect(credentialLock.read.mock.invocationCallOrder[0]).toBeLessThan(
      paymentLine.notify.mock.invocationCallOrder[0]!
    )
    expect(transactionSettled).toBe(false)

    finishNotify?.({ lineRequestId: 'line-request', status: 200 })

    await expect(execution).resolves.toMatchObject({ status: 'sent' })
    expect(transactionSettled).toBe(true)
  })

  it('does not read a queued job until the credential lock resolves', async () => {
    let releaseLock!: () => void
    credentialLock.read.mockImplementation(() => new Promise<void>((resolve) => {
      releaseLock = resolve
    }))

    const execution = executeNotificationJob('7')

    await vi.waitFor(() => expect(credentialLock.read).toHaveBeenCalledTimes(1))
    expect(db.findJob).not.toHaveBeenCalled()
    expect(db.findTarget).not.toHaveBeenCalled()
    expect(paymentLine.notify).not.toHaveBeenCalled()

    releaseLock()
    await expect(execution).resolves.toMatchObject({ status: 'sent' })
  })

  it('keeps a parked old job skipped even when the same target is active again', async () => {
    db.findJob.mockResolvedValue({
      attempt_count: 0,
      custom_message: null,
      document_no: 'PMT012607-0001',
      document_type: 'PMT',
      id: 7n,
      last_error_code: 'TARGET_INACTIVE',
      last_error_message: 'LINE target is inactive or no longer registered',
      locked_by: null,
      max_attempts: 5,
      next_retry_at: new Date(),
      requested_by: 'tester',
      retry_key: 'retry-key',
      source_id: 42n,
      source_type: 'purchase_payment',
      status: 'skipped',
      target_id: 'C-PMT',
      target_type: 'group',
    })
    db.findTarget.mockResolvedValue({ is_active: true, target_id: 'C-PMT' })

    await expect(executeNotificationJob('7', { force: true })).resolves.toMatchObject({
      status: 'skipped',
    })

    expect(db.findTarget).not.toHaveBeenCalled()
    expect(db.updateJob).not.toHaveBeenCalled()
    expect(db.createAttempt).not.toHaveBeenCalled()
    expect(paymentLine.notify).not.toHaveBeenCalled()
  })

  it('reuses an outer credential lock for enqueue and execution without a nested lock', async () => {
    await expect(enqueueAndExecuteNotification(
      { documentNo: 'PMT012607-0001', sourceType: 'purchase_payment' },
      { credentialLockHeld: true, force: false, requestedBy: 'tester' },
    )).resolves.toMatchObject({ status: 'enqueued' })

    expect(credentialLock.read).not.toHaveBeenCalled()
    expect(db.createJob).toHaveBeenCalledOnce()
    expect(paymentLine.notify).toHaveBeenCalledOnce()
  })

  it('reuses an outer credential lock without requesting a nested advisory lock', async () => {
    await expect(executeNotificationJob('7', {
      credentialLockHeld: true,
      force: true,
    })).resolves.toMatchObject({ status: 'sent' })

    expect(credentialLock.read).not.toHaveBeenCalled()
    expect(paymentLine.notify).toHaveBeenCalledOnce()
  })
})
