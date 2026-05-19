import type { Metadata } from 'next'
import { CostAllocatorPageClient } from '@/components/dual-costing/CostAllocatorPageClient'

export const metadata: Metadata = {
  title: 'Cost Allocator | NS Scrap ERP',
}

export default function CostAllocatorPage() {
  return <CostAllocatorPageClient />
}
