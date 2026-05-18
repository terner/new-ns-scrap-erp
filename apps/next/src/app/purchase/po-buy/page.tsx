import type { Metadata } from 'next'
import { PoBuyPageClient } from '@/components/purchase-flow/PoBuyPageClient'

export const metadata: Metadata = {
  title: 'PO Buy | NS Scrap ERP',
}

export default function PoBuyPage() {
  return <PoBuyPageClient />
}
