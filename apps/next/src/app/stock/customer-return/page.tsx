import type { Metadata } from 'next'
import { StockOperationPageClient } from '@/components/stock/StockOperationPageClient'

export const metadata: Metadata = {
  title: 'Customer Return / ของคืน | NS Scrap ERP',
}

export default function StockCustomerReturnPage() {
  return <StockOperationPageClient mode="customer-return" />
}
