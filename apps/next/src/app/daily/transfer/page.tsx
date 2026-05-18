import type { Metadata } from 'next'
import { DailyTransferPageClient } from '@/components/daily/DailyTransferPageClient'

export const metadata: Metadata = {
  title: 'โอนเงินระหว่างบัญชี | NS Scrap ERP',
}

export default function DailyTransferPage() {
  return <DailyTransferPageClient />
}
