import type { Metadata } from 'next'
import { AccountsPayablePageClient } from '@/components/purchase-flow/AccountsPayablePageClient'

export const metadata: Metadata = {
  title: 'เจ้าหนี้ AP | NS Scrap ERP',
}

export default function AccountsPayablePage() {
  return <AccountsPayablePageClient />
}
