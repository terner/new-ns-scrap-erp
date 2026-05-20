import { MasterDataPageClient } from '@/components/master-data/shared/MasterDataPageClient'
import { machineTypesPageConfig } from '@/lib/master-data-page-configs'

export default function MachineTypesPage() {
  return <MasterDataPageClient config={machineTypesPageConfig} />
}
