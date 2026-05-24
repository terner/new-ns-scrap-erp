import type { Metadata } from 'next'
import { MoneyMovementPageClient } from '@/components/daily/MoneyMovementPageClient'

export const metadata: Metadata = {
  title: 'ประวัติการจ่ายเงิน | NS Scrap ERP',
}

export default function PurchasePaymentHistoryPage() {
  return <MoneyMovementPageClient historyOnly mode="payment" />
}
