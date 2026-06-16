import { MasterDataPageClient } from '@/components/master-data/shared/MasterDataPageClient'
import { departmentsPageConfig } from '@/lib/master-data-page-configs'

export default function DepartmentsPage() {
  return <MasterDataPageClient config={departmentsPageConfig} />
}
