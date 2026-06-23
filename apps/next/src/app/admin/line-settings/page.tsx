import type { Metadata } from 'next'
import { LineSettingsPageClient } from '@/app/admin/line-settings/LineSettingsPageClient'

export const metadata: Metadata = {
  title: 'ตั้งค่า LINE Notification | NS Scrap ERP',
}

export default function LineSettingsPage() {
  return <LineSettingsPageClient />
}
