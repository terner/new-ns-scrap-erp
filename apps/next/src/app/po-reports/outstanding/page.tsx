import type { Metadata } from 'next'
import { PoOutstandingPageClient } from '@/components/purchase-flow/PoOutstandingPageClient'

export const metadata: Metadata = {
  title: 'PO Outstanding | NS Scrap ERP',
}

export default function PoOutstandingPage() {
  return <PoOutstandingPageClient />
}
