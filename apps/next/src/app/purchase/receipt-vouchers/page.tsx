import type { Metadata } from 'next'
import { PageTitleOverride } from '@/components/layout/PageTitleOverride'
import { ReceiptVouchersPageClient } from '@/components/daily/ReceiptVouchersPageClient'

export const metadata: Metadata = {
  title: 'ใบสำคัญรับเงิน | NS Scrap ERP',
}

export default function ReceiptVouchersPage() {
  return (
    <>
      <PageTitleOverride
        title="ใบสำคัญรับเงิน (Receipt Voucher)"
      />
      <ReceiptVouchersPageClient />
    </>
  )
}
