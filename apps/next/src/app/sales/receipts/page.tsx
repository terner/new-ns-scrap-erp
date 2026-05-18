import type { Metadata } from 'next'
import { MoneyMovementPageClient } from '@/components/daily/MoneyMovementPageClient'

export const metadata: Metadata = {
  title: 'รับเงิน Customer | NS Scrap ERP',
}

export default function SalesReceiptsPage() {
  return <MoneyMovementPageClient mode="receipt" />
}
