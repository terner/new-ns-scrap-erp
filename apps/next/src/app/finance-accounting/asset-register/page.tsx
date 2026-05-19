import type { Metadata } from 'next'
import { AssetRegisterPageClient } from '@/components/finance-accounting/FixedAssetsPageClients'

export const metadata: Metadata = {
  title: 'Fixed Asset Register | NS Scrap ERP',
}

export default function AssetRegisterPage() {
  return <AssetRegisterPageClient />
}
