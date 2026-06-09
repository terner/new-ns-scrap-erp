import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'ประวัติเปลี่ยน Supplier ในบิล | NS Scrap ERP',
}

export default function BillSwapHistoryPage() {
  redirect('/purchase/bills?tab=supplier-swap-history')
}
