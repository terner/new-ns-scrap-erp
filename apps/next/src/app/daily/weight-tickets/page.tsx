import type { Metadata } from 'next'
import { WeightTicketsPageClient } from '@/components/daily/WeightTicketsPageClient'
import { PageTitleOverride } from '@/components/layout/PageTitleOverride'

export const metadata: Metadata = {
  title: 'ชั่งสินค้า / รับ-ส่งของ | NS Scrap ERP',
}

export default async function WeightTicketsPage({
  searchParams,
}: {
  searchParams?: Promise<{ id?: string | string[]; type?: string | string[] }>
}) {
  const resolved = await searchParams
  const ticketId = Array.isArray(resolved?.id) ? resolved?.id[0] : resolved?.id
  const typeParam = Array.isArray(resolved?.type) ? resolved?.type[0] : resolved?.type
  const initialType = typeParam === 'WTO' ? 'WTO' : 'WTI'
  const editing = Boolean(ticketId && ticketId.trim())
  const lockType = !editing && (typeParam === 'WTI' || typeParam === 'WTO')
  return (
    <>
      <PageTitleOverride
        subtitle={editing ? 'แก้ไขได้จนกว่าจะถูกนำไปใช้กับบิลรับซื้อหรือบิลขาย' : 'ระบบจะออกเลขเอกสาร วันที่ เวลา และผู้กรอกหลังบันทึก'}
        title="ชั่งสินค้า / รับ-ส่งของ"
      />
      <WeightTicketsPageClient initialType={initialType} lockType={lockType} ticketId={ticketId ?? ''} />
    </>
  )
}
