import type { Metadata } from 'next'
import { TransactionLedgerPageClient } from '@/app/admin/transaction-ledger/TransactionLedgerPageClient'

export const metadata: Metadata = {
  title: 'Transaction Ledger | NS Scrap ERP',
}

export default function TransactionLedgerPage() {
  return <TransactionLedgerPageClient />
}
