import { findActiveSalesChannelReferenceByCode as findCachedSalesChannelReferenceByCode } from '@/lib/server/reference-master-cache'

type SalesChannelReference = {
  code: string
  id: bigint
  name: string
}

export async function findActiveSalesChannelReferenceByCode(
  value: string | null | undefined,
): Promise<SalesChannelReference | null> {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (!normalized) return null

  return findCachedSalesChannelReferenceByCode(normalized)
}
