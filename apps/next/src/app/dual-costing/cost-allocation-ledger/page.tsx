import { DualCostingManagementPageClient } from '@/components/dual-costing/DualCostingManagementPageClient'
import { PageTitleOverride } from '@/components/layout/PageTitleOverride'

export default function CostAllocationLedgerPage() {
  return (
    <>
      <PageTitleOverride title="Cost Allocation Ledger" />
      <DualCostingManagementPageClient mode="ledger" />
    </>
  )
}
