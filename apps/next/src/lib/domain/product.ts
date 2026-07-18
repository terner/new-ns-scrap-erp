import { requireBusinessCode } from '@/lib/business-code'
import { getProductImageDisplay } from '@/lib/product-images'
import { productFormSchema, productSchema, type Product, type ProductFormValues } from '@/lib/product'

type PrismaProduct = {
  id: bigint
  code: string
  name: string
  active: boolean | null
  type: string | null
  unit: string | null
  image_storage_key: string | null
  image_thumbnail_storage_key: string | null
  created_at: Date | null
  updated_at: Date | null
}

export function mapPrismaProduct(row: PrismaProduct): Product {
  const outwardId = requireBusinessCode(row.code, `สินค้า ${row.id}`)
  const image = getProductImageDisplay(row.image_storage_key, row.image_thumbnail_storage_key)
  return productSchema.parse({
    id: outwardId,
    code: outwardId,
    name: row.name,
    active: row.active ?? true,
    imageNames: image.imageNames,
    imageStorageKey: image.imageStorageKey,
    imageThumbnailStorageKey: image.imageThumbnailStorageKey,
    originalUrl: image.originalUrl,
    thumbnailUrl: image.thumbnailUrl,
    type: row.type,
    unit: row.unit,
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
  })
}

export function toProductWriteInput(values: ProductFormValues) {
  const parsed = productFormSchema.parse(values)
  const code = parsed.code?.toUpperCase() || parsed.id || ''

  if (!code) {
    throw new Error('ไม่พบรหัสสินค้า')
  }

  return {
    code,
    name: parsed.name,
    type: parsed.type || null,
    unit: parsed.unit || 'กก.',
    image_storage_key: parsed.imageStorageKey,
    image_thumbnail_storage_key: parsed.imageThumbnailStorageKey,
    active: parsed.active,
  }
}
