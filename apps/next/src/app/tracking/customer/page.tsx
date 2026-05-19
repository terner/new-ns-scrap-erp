import type { Metadata } from 'next'
import { CustomerTrackingPageClient } from '@/components/tracking/CustomerTrackingPageClient'

export const metadata: Metadata = {
  title: 'Customer Tracking | NS Scrap ERP',
}

export default function CustomerTrackingPage() {
  return <CustomerTrackingPageClient />
}
