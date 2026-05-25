import type { Metadata } from 'next'
import { WeightTicketDetailPageClient } from '@/components/daily/WeightTicketDetailPageClient'

export const metadata: Metadata = {
  title: 'รายละเอียดใบรับ-ส่งของ | NS Scrap ERP',
}

export default async function WeightTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <WeightTicketDetailPageClient ticketId={id} />
}
