import type { Metadata } from 'next'
import { TransactionBillsPageClient } from '@/components/daily/TransactionBillsPageClient'

export const metadata: Metadata = {
  title: 'บิลขาย | NS Scrap ERP',
}

export default function SalesBillsPage() {
  return <TransactionBillsPageClient mode="sales" />
}
