import type { Metadata } from 'next'
import { DealMarginPageClient } from '@/components/dual-costing/DealMarginPageClient'

export const metadata: Metadata = {
  title: 'Deal Margin Report | NS Scrap ERP',
}

export default function DealMarginPage() {
  return <DealMarginPageClient />
}
