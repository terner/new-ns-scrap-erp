import type { Metadata } from 'next'
import { StockBalancePageClient } from '@/components/stock/StockBalancePageClient'

export const metadata: Metadata = {
  title: 'สต๊อกคงเหลือ | NS Scrap ERP',
}

export default function StockBalancePage() {
  return <StockBalancePageClient />
}
