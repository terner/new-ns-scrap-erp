import type { Metadata } from 'next'
import { OverseasReceiptPageClient } from '@/components/finance/foreign/OverseasReceiptPageClient'

export const metadata: Metadata = {
  title: 'Overseas Receipt | NS Scrap ERP',
}

export default function OverseasReceiptPage() {
  return <OverseasReceiptPageClient />
}
