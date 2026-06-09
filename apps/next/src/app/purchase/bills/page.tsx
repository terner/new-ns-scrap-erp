import type { Metadata } from 'next'
import { PurchaseBillsPageClient } from '@/components/purchase-flow/PurchaseBillsPageClient'

export const metadata: Metadata = {
  title: 'บิลรับซื้อ | NS Scrap ERP',
}

type PurchaseBillsPageProps = {
  searchParams?: Promise<{ tab?: string }>
}

export default async function PurchaseBillsPage({ searchParams }: PurchaseBillsPageProps) {
  const params = await searchParams
  const initialTab = params?.tab === 'supplier-swap-history' ? 'supplier-swap-history' : 'bills'
  return <PurchaseBillsPageClient initialTab={initialTab} />
}
