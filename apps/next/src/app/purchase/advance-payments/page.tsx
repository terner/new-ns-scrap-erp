import type { Metadata } from 'next'
import { AdvancePaymentsPageClient } from '@/components/purchase-flow/AdvancePaymentsPageClient'

export const metadata: Metadata = {
  title: 'จ่ายเงินล่วงหน้า / มัดจำ | NS Scrap ERP',
}

export default function AdvancePaymentsPage() {
  return <AdvancePaymentsPageClient />
}
