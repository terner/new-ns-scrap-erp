import { MasterDataPageClient } from '@/components/master-data/shared/MasterDataPageClient'
import { productUnitsPageConfig } from '@/lib/master-data-page-configs'

export default function ProductUnitsPage() {
  return <MasterDataPageClient config={productUnitsPageConfig} />
}
