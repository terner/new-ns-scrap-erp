import type { Metadata } from 'next'
import { EquityMaintenancePageClient } from '@/components/finance-accounting/LoansEquityPageClients'

export const metadata: Metadata = {
  title: 'Equity | NS Scrap ERP',
}

export default function EquityMaintenancePage() {
  return <EquityMaintenancePageClient />
}
