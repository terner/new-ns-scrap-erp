import { MasterDataPageClient } from '@/components/master-data/shared/MasterDataPageClient'
import { assetCategoriesPageConfig } from '@/lib/master-data-page-configs'

export default function AssetCategoriesPage() {
  return <MasterDataPageClient config={assetCategoriesPageConfig} />
}
