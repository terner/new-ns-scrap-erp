import type { Metadata } from 'next'
import { MoneyMovementPageClient } from '@/components/daily/MoneyMovementPageClient'

export const metadata: Metadata = {
  title: 'จ่ายเงิน Supplier | NS Scrap ERP',
}

export default function PurchasePaymentsPage() {
  return <MoneyMovementPageClient mode="payment" />
}
