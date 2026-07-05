import { DualCostingManagementPageClient } from '@/components/dual-costing/DualCostingManagementPageClient'
import { PageTitleOverride } from '@/components/layout/PageTitleOverride'

export default function DualCostingReportPage() {
  return (
    <>
      <PageTitleOverride title="Dual Costing Report" />
      <DualCostingManagementPageClient mode="report" />
    </>
  )
}
