import type { Metadata } from 'next'
import { MatchLogPageClient } from '@/components/dual-costing/MatchLogPageClient'

export const metadata: Metadata = {
  title: 'Match Log | NS Scrap ERP',
}

export default function MatchLogPage() {
  return <MatchLogPageClient />
}
