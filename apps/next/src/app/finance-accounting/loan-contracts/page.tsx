import type { Metadata } from 'next'
import { LoanContractsPageClient } from '@/components/finance-accounting/LoansEquityPageClients'

export const metadata: Metadata = {
  title: 'Loan / Leasing / BSL | NS Scrap ERP',
}

export default function LoanContractsPage() {
  return <LoanContractsPageClient />
}
