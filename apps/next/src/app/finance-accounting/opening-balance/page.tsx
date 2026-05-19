import type { Metadata } from 'next'
import { OpeningBalancePageClient } from '@/components/finance-accounting/LoansEquityPageClients'

export const metadata: Metadata = {
  title: 'Opening Balance | NS Scrap ERP',
}

export default function OpeningBalancePage() {
  return <OpeningBalancePageClient />
}
