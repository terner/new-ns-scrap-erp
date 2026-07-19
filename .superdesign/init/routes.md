# Relevant Routes

- `/daily/weight-ticket-list` -> `apps/next/src/app/daily/weight-ticket-list/page.tsx` -> combined WTI/WTO register.
- `/daily/weight-ticket-list/[id]` -> `apps/next/src/app/daily/weight-ticket-list/[id]/page.tsx` -> full detail route.
- `/daily/weight-tickets?type=WTI` -> `apps/next/src/app/daily/weight-tickets/page.tsx` -> locked WTI creation/edit form.
- `/daily/weight-tickets?type=WTO` -> same route with locked WTO creation/edit form.
- All protected routes render through `apps/next/src/app/layout.tsx` and `AppShell`.

## `apps/next/src/app/daily/weight-ticket-list/page.tsx`

```tsx
import type { Metadata } from 'next'
import { WeightTicketListPageClient } from '../../../components/daily/WeightTicketListPageClient'

export const metadata: Metadata = {
  title: 'รายการใบรับ-ส่งของ | NS Scrap ERP',
}

export default function WeightTicketListPage() {
  return <WeightTicketListPageClient />
}

```
## `apps/next/src/app/daily/weight-tickets/page.tsx`

```tsx
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
        title="ชั่งสินค้า / รับ-ส่งของ"
      />
      <WeightTicketsPageClient initialType={initialType} lockType={lockType} ticketId={ticketId ?? ''} />
    </>
  )
}

```
