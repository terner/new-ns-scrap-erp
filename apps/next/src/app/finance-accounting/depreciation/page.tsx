import type { Metadata } from 'next'
import { DepreciationPageClient } from '@/components/finance-accounting/FixedAssetsPageClients'

export const metadata: Metadata = {
  title: 'Depreciation | NS Scrap ERP',
}

export default function DepreciationPage() {
  return <DepreciationPageClient />
}
