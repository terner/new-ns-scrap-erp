import { MasterDataPageClient } from '@/components/master-data/shared/MasterDataPageClient'
import { bankNamesPageConfig } from '@/lib/master-data-page-configs'

export default function BankNamesPage() {
  return <MasterDataPageClient config={bankNamesPageConfig} />
}
