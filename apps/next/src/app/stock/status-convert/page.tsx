import type { Metadata } from 'next'
import { StockOperationPageClient } from '@/components/stock/StockOperationPageClient'

export const metadata: Metadata = {
  title: 'ปรับสถานะสินค้า | NS Scrap ERP',
}

export default function StockStatusConvertPage() {
  return <StockOperationPageClient mode="status-convert" />
}
