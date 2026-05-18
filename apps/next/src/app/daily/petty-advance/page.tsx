import type { Metadata } from 'next'
import { DailyPettyAdvancePageClient } from '@/components/daily/DailyPettyAdvancePageClient'

export const metadata: Metadata = {
  title: 'เงินสำรองจ่าย | NS Scrap ERP',
}

export default function DailyPettyAdvancePage() {
  return <DailyPettyAdvancePageClient />
}
