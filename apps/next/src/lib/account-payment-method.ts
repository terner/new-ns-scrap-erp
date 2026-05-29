import type { MasterDataRecord } from '@/lib/master-data'

export type PaymentMethodGroup = 'cash' | 'bank'

export function paymentMethodGroupLabel(group: PaymentMethodGroup | null | undefined) {
  if (group === 'cash') return 'เงินสด'
  if (group === 'bank') return 'ธนาคาร'
  return null
}

export function paymentMethodGroupFromRecord(record: Pick<MasterDataRecord, 'type'> | null | undefined): PaymentMethodGroup {
  return record?.type === 'cash' ? 'cash' : 'bank'
}

export function fallbackPaymentMethodGroupFromText(value: string | null | undefined) {
  const normalized = String(value ?? '').trim()
  const lower = normalized.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('เงินสด') || lower.includes('cash')) return 'cash'
  return 'bank'
}

export function paymentMethodGroupFromValue(
  value: string | null | undefined,
  paymentMethods: Array<Pick<MasterDataRecord, 'name' | 'type'>>,
) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return null
  const matched = paymentMethods.find((row) => row.name === normalized)
  return matched ? paymentMethodGroupFromRecord(matched) : fallbackPaymentMethodGroupFromText(normalized)
}

export function defaultPaymentMethodNameByGroup(
  paymentMethods: Array<Pick<MasterDataRecord, 'name' | 'type'>>,
  group: PaymentMethodGroup,
) {
  return paymentMethods.find((row) => paymentMethodGroupFromRecord(row) === group)?.name ?? null
}

export function resolvePaymentMethodName(
  value: string | null | undefined,
  paymentMethods: Array<Pick<MasterDataRecord, 'name' | 'type'>>,
) {
  const normalized = String(value ?? '').trim()
  if (!normalized) return null
  const matched = paymentMethods.find((row) => row.name === normalized)
  if (matched) return matched.name
  const inferredGroup = fallbackPaymentMethodGroupFromText(normalized)
  return inferredGroup ? defaultPaymentMethodNameByGroup(paymentMethods, inferredGroup) ?? normalized : normalized
}

export function resolvePaymentMethodValueForAccount(
  record: Pick<MasterDataRecord, 'currency' | 'subtype' | 'type'>,
  paymentMethods: Array<Pick<MasterDataRecord, 'name' | 'type'>>,
) {
  const currentType = String(record.type ?? '').trim()
  if (currentType && paymentMethods.some((row) => row.name === currentType)) {
    return currentType
  }

  const targetGroup: PaymentMethodGroup = record.subtype === 'cash' ? 'cash' : 'bank'
  return paymentMethods.find((row) => paymentMethodGroupFromRecord(row) === targetGroup)?.name ?? (currentType || null)
}
