import type { Metadata } from 'next'
import { ProductTrackingPageClient } from '@/components/tracking/ProductTrackingPageClient'

export const metadata: Metadata = {
  title: 'Product Tracking | NS Scrap ERP',
}

export default function ProductTrackingPage() {
  return <ProductTrackingPageClient />
}
