import { MasterDataPageClient } from '@/components/master-data/shared/MasterDataPageClient'
import { vatSettingsPageConfig, whtSettingsPageConfig } from '@/lib/master-data-page-configs'

export default function SystemSettingsPage() {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800">VAT</h2>
        <MasterDataPageClient config={vatSettingsPageConfig} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-800">WHT</h2>
        <MasterDataPageClient config={whtSettingsPageConfig} />
      </section>
    </div>
  )
}
