import type { Metadata } from 'next'
import { IntlTransferPageClient } from '@/components/finance/foreign/IntlTransferPageClient'

export const metadata: Metadata = {
  title: 'International Transfer | NS Scrap ERP',
}

export default function IntlTransferPage() {
  return <IntlTransferPageClient />
}
