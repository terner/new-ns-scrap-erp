import type { Metadata } from 'next'
import { TradingMatchingPageClient } from '@/components/purchase-flow/TradingMatchingPageClient'

export const metadata: Metadata = {
  title: 'Trading Matching | NS Scrap ERP',
}

export default function TradingMatchingPage() {
  return <TradingMatchingPageClient />
}
