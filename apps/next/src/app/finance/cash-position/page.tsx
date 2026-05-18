import type { Metadata } from 'next'
import { CashPositionPageClient } from '@/components/finance/CashPositionPageClient'

export const metadata: Metadata = {
  title: 'Cash Position | NS Scrap ERP',
}

export default function CashPositionPage() {
  return <CashPositionPageClient />
}
