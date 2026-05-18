import type { Metadata } from 'next'
import { AccountsReceivablePageClient } from '@/components/finance/AccountsReceivablePageClient'

export const metadata: Metadata = {
  title: 'ลูกหนี้ AR | NS Scrap ERP',
}

export default function AccountsReceivablePage() {
  return <AccountsReceivablePageClient />
}
