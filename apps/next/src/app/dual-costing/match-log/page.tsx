import type { Metadata } from 'next'
import { MatchLogPageClient } from '@/components/dual-costing/MatchLogPageClient'
import { PageTitleOverride } from '@/components/layout/PageTitleOverride'

export const metadata: Metadata = {
  title: 'Match Log | NS Scrap ERP',
}

export default function MatchLogPage() {
  return (
    <>
      <PageTitleOverride title="Match Log" />
      <MatchLogPageClient />
    </>
  )
}
