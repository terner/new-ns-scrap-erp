import type { Metadata } from 'next'
import { HistoricalDataPageClient } from '@/components/finance-accounting/LoansEquityPageClients'

export const metadata: Metadata = {
  title: 'Historical Data | NS Scrap ERP',
}

export default function HistoricalDataPage() {
  return <HistoricalDataPageClient />
}
