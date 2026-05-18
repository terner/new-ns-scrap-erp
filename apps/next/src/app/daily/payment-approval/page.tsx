import type { Metadata } from 'next'
import { PaymentApprovalPageClient } from '@/components/daily/PaymentApprovalPageClient'

export const metadata: Metadata = {
  title: 'อนุมัติโอนเงิน | NS Scrap ERP',
}

export default function PaymentApprovalPage() {
  return <PaymentApprovalPageClient />
}
