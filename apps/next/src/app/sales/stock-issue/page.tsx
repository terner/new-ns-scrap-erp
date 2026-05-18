import type { Metadata } from 'next'
import { TransactionBillsPageClient } from '@/components/daily/TransactionBillsPageClient'

export const metadata: Metadata = {
  title: 'เบิกออกรอบิล | NS Scrap ERP',
}

export default function SalesStockIssuePage() {
  return <TransactionBillsPageClient mode="stock-issue" />
}
