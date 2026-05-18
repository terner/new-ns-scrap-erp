import type { Metadata } from 'next'
import { StockLedgerPageClient } from '@/components/purchase-flow/StockLedgerPageClient'

export const metadata: Metadata = {
  title: 'Stock Ledger | NS Scrap ERP',
}

export default function StockLedgerPage() {
  return <StockLedgerPageClient />
}
