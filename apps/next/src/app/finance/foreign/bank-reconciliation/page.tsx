import type { Metadata } from 'next'
import { BankReconciliationPageClient } from '@/components/finance/foreign/BankReconciliationPageClient'

export const metadata: Metadata = {
  title: 'Bank Reconciliation | NS Scrap ERP',
}

export default function BankReconciliationPage() {
  return <BankReconciliationPageClient />
}
