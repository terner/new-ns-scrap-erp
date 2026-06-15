import type { Metadata } from 'next'
import { ProductTrackingPageClient } from '@/components/tracking/ProductTrackingPageClient'

export const metadata: Metadata = {
  title: 'Product Tracking | NS Scrap ERP',
}

type ProductTrackingPageProps = {
  searchParams?: Promise<{
    customerId?: string
    metalGroup?: string
    month?: string
    productId?: string
    q?: string
    supplierId?: string
    year?: string
  }>
}

export default async function ProductTrackingPage({ searchParams }: ProductTrackingPageProps) {
  const params = await searchParams
  return (
    <ProductTrackingPageClient
      initialCustomerId={params?.customerId}
      initialMetalGroup={params?.metalGroup}
      initialMonth={params?.month}
      initialProductId={params?.productId}
      initialSearch={params?.q}
      initialSupplierId={params?.supplierId}
      initialYear={params?.year}
    />
  )
}
