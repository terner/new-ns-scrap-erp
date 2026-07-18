import type { Prisma } from '../../../generated/prisma/client'
import { calculateCustomerAdvancePaidBaseCapacity } from '@/lib/customer-advance'
import { toNumber } from '@/lib/server/daily'

type CustomerAdvanceSettlementTx = Pick<
  Prisma.TransactionClient,
  'customer_advance_status_logs' | 'customer_advance_statuses' | 'customer_advances' | 'sales_bill_customer_advance_allocations'
>

type NumericValue = { toNumber: () => number } | number | null | undefined
const MONEY_EPSILON = 0.005

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function customerAdvanceStatusCode(params: {
  allocatedAmount: number
  baseCapacity: number
  cancelled: boolean
  receivedAmount: number
  targetAmount: number
}) {
  if (params.cancelled) return 'cancelled'
  if (params.allocatedAmount > 0.01 && params.baseCapacity - params.allocatedAmount <= 0.01) return 'allocated'
  if (params.allocatedAmount > 0.01) return 'partially_allocated'
  if (params.receivedAmount >= params.targetAmount - 0.01) return 'received'
  if (params.receivedAmount > 0.01) return 'partially_received'
  return 'pending_receipt'
}

export async function refreshCustomerAdvanceAllocation(
  tx: CustomerAdvanceSettlementTx,
  customerAdvanceId: bigint,
  actor: string,
) {
  const [advance, statuses] = await Promise.all([
    tx.customer_advances.findUnique({
      select: {
        allocated_amount: true,
        available_amount: true,
        cancelled_at: true,
        doc_no: true,
        id: true,
        received_amount: true,
        status_id: true,
        subtotal_amount: true,
        target_amount: true,
      },
      where: { id: customerAdvanceId },
    }),
    tx.customer_advance_statuses.findMany({
      select: { code: true, id: true },
      where: { active: true },
    }),
  ])

  if (!advance) throw new Error('ไม่พบ CADV ที่ต้องการคำนวณสถานะ')
  const activeAllocations = await tx.sales_bill_customer_advance_allocations.findMany({
    select: {
      allocated_amount: true,
      allocated_subtotal_amount: true,
    },
    where: {
      customer_advance_doc_no: advance.doc_no,
      status: 'active',
    },
  })

  const targetAmount = toNumber(advance.target_amount as NumericValue)
  const subtotalAmount = toNumber(advance.subtotal_amount as NumericValue)
  const receivedAmount = toNumber(advance.received_amount as NumericValue)
  if (targetAmount <= 0 || subtotalAmount <= 0) {
    throw new Error('ข้อมูลยอดเงิน CADV ไม่ถูกต้อง กรุณาแก้ข้อมูลต้นทางก่อนคำนวณสถานะ')
  }

  const baseCapacity = calculateCustomerAdvancePaidBaseCapacity({
    receivedGrossAmount: receivedAmount,
    subtotalAmount,
    targetAmount,
  })
  const allocatedAmount = roundMoney(activeAllocations.reduce((sum, allocation) => (
    sum + (toNumber(allocation.allocated_subtotal_amount as NumericValue) || toNumber(allocation.allocated_amount as NumericValue))
  ), 0))
  if (allocatedAmount - baseCapacity > 0.01) throw new Error('ยอดใช้หักบิลรวมเกินยอด CADV ที่รับเงินจริงแล้ว')

  const availableAmount = Math.max(0, roundMoney(baseCapacity - allocatedAmount))
  const nextStatusCode = customerAdvanceStatusCode({
    allocatedAmount,
    baseCapacity,
    cancelled: Boolean(advance.cancelled_at),
    receivedAmount,
    targetAmount,
  })
  const nextStatus = statuses.find((status) => status.code === nextStatusCode)
  if (!nextStatus) throw new Error(`ไม่พบสถานะ CADV ${nextStatusCode}`)

  await tx.customer_advances.update({
    data: {
      allocated_amount: allocatedAmount,
      available_amount: availableAmount,
      status_id: nextStatus.id,
      updated_at: new Date(),
      updated_by: actor,
    },
    where: { id: customerAdvanceId },
  })

  if (nextStatus.id !== advance.status_id) {
    await tx.customer_advance_status_logs.create({
      data: {
        action: `status_${nextStatusCode}`,
        allocated_amount_snapshot: allocatedAmount,
        available_amount_snapshot: availableAmount,
        created_by: actor,
        customer_advance_doc_no: advance.doc_no,
        customer_advance_id: advance.id,
        event_key: `customer-advance.status.${advance.doc_no}.${nextStatusCode}.${Date.now()}`,
        from_status_id: advance.status_id,
        meta: { source: 'customer_advance_settlement' },
        received_amount_snapshot: receivedAmount,
        target_amount_snapshot: targetAmount,
        to_status_id: nextStatus.id,
      },
    })
  }

  return {
    allocatedAmount,
    availableAmount,
    baseCapacity,
    status: nextStatusCode,
  }
}

export type CustomerAdvanceReceiptSettlement = {
  availableAfter: number
  availableBefore: number
  receivedAfter: number
  receivedBefore: number
}

export async function applyCustomerAdvanceReceipt(
  tx: Prisma.TransactionClient,
  customerAdvanceId: bigint,
  receiptAmount: number,
  actor: string,
): Promise<CustomerAdvanceReceiptSettlement> {
  const amount = roundMoney(receiptAmount)
  if (amount <= 0) throw new Error('ยอดรับ CADV ต้องมากกว่า 0')

  const advance = await tx.customer_advances.findUnique({
    select: {
      available_amount: true,
      cancelled_at: true,
      doc_no: true,
      id: true,
      received_amount: true,
      target_amount: true,
      version: true,
    },
    where: { id: customerAdvanceId },
  })
  if (!advance) throw new Error('ไม่พบ CADV ที่ต้องการรับเงิน')
  if (advance.cancelled_at) throw new Error(`CADV ${advance.doc_no} ถูกยกเลิกแล้ว`)

  const receivedBefore = roundMoney(toNumber(advance.received_amount))
  const targetAmount = roundMoney(toNumber(advance.target_amount))
  const remaining = roundMoney(targetAmount - receivedBefore)
  if (remaining <= MONEY_EPSILON) throw new Error(`CADV ${advance.doc_no} รับเงินครบแล้ว`)
  if (amount > remaining + MONEY_EPSILON) throw new Error(`ยอดรับ CADV ${advance.doc_no} เกินยอดคงเหลือ ${remaining.toFixed(2)}`)

  const receivedAfter = roundMoney(receivedBefore + amount)
  const updated = await tx.customer_advances.updateMany({
    data: {
      received_amount: receivedAfter,
      updated_at: new Date(),
      updated_by: actor,
      version: { increment: 1 },
    },
    where: { id: advance.id, received_amount: advance.received_amount, version: advance.version },
  })
  if (updated.count !== 1) throw new Error(`CADV ${advance.doc_no} ถูกเปลี่ยนแปลงระหว่างรับเงิน กรุณาโหลดข้อมูลใหม่`)

  const refreshed = await refreshCustomerAdvanceAllocation(tx, advance.id, actor)
  await tx.customer_advance_status_logs.create({
    data: {
      action: 'receipt_allocated',
      allocated_amount_snapshot: refreshed.allocatedAmount,
      available_amount_snapshot: refreshed.availableAmount,
      created_by: actor,
      customer_advance_doc_no: advance.doc_no,
      customer_advance_id: advance.id,
      event_key: `customer-advance.receipt-allocated.${advance.doc_no}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`,
      meta: { receiptAmount: amount, source: 'customer_receipt' },
      received_amount_snapshot: receivedAfter,
      target_amount_snapshot: targetAmount,
      to_status_id: (await tx.customer_advance_statuses.findFirstOrThrow({ where: { code: refreshed.status } })).id,
    },
  })

  return {
    availableAfter: refreshed.availableAmount,
    availableBefore: roundMoney(toNumber(advance.available_amount)),
    receivedAfter,
    receivedBefore,
  }
}

export async function reverseCustomerAdvanceReceipt(
  tx: Prisma.TransactionClient,
  customerAdvanceId: bigint,
  receiptAmount: number,
  actor: string,
): Promise<CustomerAdvanceReceiptSettlement> {
  const amount = roundMoney(receiptAmount)
  if (amount <= 0) throw new Error('ยอด reverse CADV ต้องมากกว่า 0')

  const advance = await tx.customer_advances.findUnique({
    select: {
      available_amount: true,
      cancelled_at: true,
      doc_no: true,
      id: true,
      received_amount: true,
      target_amount: true,
      version: true,
    },
    where: { id: customerAdvanceId },
  })
  if (!advance) throw new Error('ไม่พบ CADV ที่ต้อง reverse')
  const receivedBefore = roundMoney(toNumber(advance.received_amount))
  const receivedAfter = roundMoney(receivedBefore - amount)
  if (receivedAfter < -MONEY_EPSILON) throw new Error(`ยอด reverse CADV ${advance.doc_no} เกินยอดรับปัจจุบัน`)

  const updated = await tx.customer_advances.updateMany({
    data: {
      received_amount: Math.max(0, receivedAfter),
      updated_at: new Date(),
      updated_by: actor,
      version: { increment: 1 },
    },
    where: { id: advance.id, received_amount: advance.received_amount, version: advance.version },
  })
  if (updated.count !== 1) throw new Error(`CADV ${advance.doc_no} ถูกเปลี่ยนแปลงระหว่างยกเลิกรับเงิน กรุณาโหลดข้อมูลใหม่`)

  const refreshed = await refreshCustomerAdvanceAllocation(tx, advance.id, actor)
  await tx.customer_advance_status_logs.create({
    data: {
      action: 'receipt_reversed',
      allocated_amount_snapshot: refreshed.allocatedAmount,
      available_amount_snapshot: refreshed.availableAmount,
      created_by: actor,
      customer_advance_doc_no: advance.doc_no,
      customer_advance_id: advance.id,
      event_key: `customer-advance.receipt-reversed.${advance.doc_no}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`,
      meta: { receiptAmount: amount, source: 'customer_receipt_cancel' },
      received_amount_snapshot: Math.max(0, receivedAfter),
      target_amount_snapshot: toNumber(advance.target_amount),
      to_status_id: (await tx.customer_advance_statuses.findFirstOrThrow({ where: { code: refreshed.status } })).id,
    },
  })

  return {
    availableAfter: refreshed.availableAmount,
    availableBefore: roundMoney(toNumber(advance.available_amount)),
    receivedAfter: Math.max(0, receivedAfter),
    receivedBefore,
  }
}
