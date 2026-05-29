import { MasterDataPageClient } from '@/components/master-data/shared/MasterDataPageClient'
import { accountSubtypesPageConfig } from '@/lib/master-data-page-configs'

export default function AccountSubtypesPage() {
  return <MasterDataPageClient config={accountSubtypesPageConfig} />
}
