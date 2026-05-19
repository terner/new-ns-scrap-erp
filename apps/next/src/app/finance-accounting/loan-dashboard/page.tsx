import type { Metadata } from 'next'
import { LoanDashboardPageClient } from '@/components/finance-accounting/LoansEquityPageClients'

export const metadata: Metadata = {
  title: 'Loan Dashboard | NS Scrap ERP',
}

export default function LoanDashboardPage() {
  return <LoanDashboardPageClient />
}
