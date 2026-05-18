import type { Metadata } from 'next'
import { StockOperationPageClient } from '@/components/stock/StockOperationPageClient'

export const metadata: Metadata = {
  title: 'ปรับเกรดสินค้า | NS Scrap ERP',
}

export default function StockConvertPage() {
  return <StockOperationPageClient mode="convert" />
}
