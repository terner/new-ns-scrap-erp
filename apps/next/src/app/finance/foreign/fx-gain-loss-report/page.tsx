import type { Metadata } from 'next'
import { FxGainLossReportPageClient } from '@/components/finance/foreign/FxGainLossReportPageClient'

export const metadata: Metadata = {
  title: 'FX Gain/Loss Report | NS Scrap ERP',
}

export default function FxGainLossReportPage() {
  return <FxGainLossReportPageClient />
}
