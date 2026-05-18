import type { Metadata } from 'next'
import { TransactionBillsPageClient } from '@/components/daily/TransactionBillsPageClient'

export const metadata: Metadata = {
  title: 'บิลรับซื้อ | NS Scrap ERP',
}

export default function PurchaseBillsPage() {
  return <TransactionBillsPageClient mode="purchase" />
}
