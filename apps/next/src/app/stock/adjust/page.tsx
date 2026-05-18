import type { Metadata } from 'next'
import { StockOperationPageClient } from '@/components/stock/StockOperationPageClient'

export const metadata: Metadata = {
  title: 'นับสต๊อก / Stock Count Adjust | NS Scrap ERP',
}

export default function StockAdjustPage() {
  return <StockOperationPageClient mode="adjust" />
}
