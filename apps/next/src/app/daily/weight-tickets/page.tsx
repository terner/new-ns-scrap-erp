import type { Metadata } from 'next'
import { WeightTicketsPageClient } from '@/components/daily/WeightTicketsPageClient'

export const metadata: Metadata = {
  title: 'ชั่งสินค้า / รับ-ส่งของ | NS Scrap ERP',
}

export default async function WeightTicketsPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string | string[] }>
}) {
  const resolved = await searchParams
  const ticketId = Array.isArray(resolved?.id) ? resolved?.id[0] : resolved?.id
  return <WeightTicketsPageClient ticketId={ticketId ?? ''} />
}
