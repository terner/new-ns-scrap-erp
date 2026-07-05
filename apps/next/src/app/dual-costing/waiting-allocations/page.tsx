import { DualCostingManagementPageClient } from '@/components/dual-costing/DualCostingManagementPageClient'
import { PageTitleOverride } from '@/components/layout/PageTitleOverride'

export default function WaitingAllocationsPage() {
  return (
    <>
      <PageTitleOverride title="Waiting Allocations" />
      <DualCostingManagementPageClient mode="waiting" />
    </>
  )
}
