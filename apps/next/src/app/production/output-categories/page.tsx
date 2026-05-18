import { MasterDataPageClient } from '@/components/master-data/shared/MasterDataPageClient'
import { productionOutputCategoriesPageConfig } from '@/lib/master-data-page-configs'

export default function ProductionOutputCategoriesPage() {
  return <MasterDataPageClient config={productionOutputCategoriesPageConfig} />
}
