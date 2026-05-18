import type { Metadata } from 'next'
import { ReceiptVouchersPageClient } from '@/components/daily/ReceiptVouchersPageClient'

export const metadata: Metadata = {
  title: 'ใบสำคัญรับเงิน | NS Scrap ERP',
}

export default function ReceiptVouchersPage() {
  return <ReceiptVouchersPageClient />
}
