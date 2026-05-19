import type { Metadata } from 'next'
import { FxRatePageClient } from '@/components/finance/foreign/FxRatePageClient'

export const metadata: Metadata = {
  title: 'FX Rate Management | NS Scrap ERP',
}

export default function FxRatePage() {
  return <FxRatePageClient />
}
