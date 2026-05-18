import { MasterDataPageClient } from '@/components/master-data/shared/MasterDataPageClient'
import { productTypesPageConfig } from '@/lib/master-data-page-configs'

export default function ProductTypesPage() {
  return <MasterDataPageClient config={productTypesPageConfig} />
}
