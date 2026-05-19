import type { Metadata } from 'next'
import { AssetDisposalPageClient } from '@/components/finance-accounting/FixedAssetsPageClients'

export const metadata: Metadata = {
  title: 'Asset Disposal | NS Scrap ERP',
}

export default function AssetDisposalPage() {
  return <AssetDisposalPageClient />
}
