import { Prisma } from '../../../generated/prisma/client'
import { productFormSchema, productSchema, type Product, type ProductFormValues } from '@/lib/product'

type PrismaProduct = {
  id: string
  code: string
  name: string
  active: boolean | null
  type: string | null
  unit: string | null
  metal_group: string | null
  item_status: string | null
  grade: string | null
  std_price: Prisma.Decimal | null
  std_cost: Prisma.Decimal | null
  target_margin_pct: Prisma.Decimal | null
  created_at: Date | null
  updated_at: Date | null
}

export function mapPrismaProduct(row: PrismaProduct): Product {
  return productSchema.parse({
    id: row.id,
    code: row.code,
    name: row.name,
    active: row.active ?? true,
    type: row.type,
    unit: row.unit,
    metalGroup: row.metal_group,
    itemStatus: row.item_status,
    grade: row.grade,
    stdPrice: row.std_price === null ? null : row.std_price.toNumber(),
    stdCost: row.std_cost === null ? null : row.std_cost.toNumber(),
    targetMarginPct: row.target_margin_pct === null ? null : row.target_margin_pct.toNumber(),
    createdAt: row.created_at?.toISOString() ?? null,
    updatedAt: row.updated_at?.toISOString() ?? null,
  })
}

export function toProductWriteInput(values: ProductFormValues) {
  const parsed = productFormSchema.parse(values)
  const code = parsed.code.toUpperCase()

  return {
    id: parsed.id || code,
    code,
    name: parsed.name,
    type: parsed.type || null,
    unit: parsed.unit || 'kg',
    metal_group: parsed.metalGroup || null,
    item_status: parsed.itemStatus,
    grade: parsed.grade || null,
    std_price: parsed.stdPrice,
    std_cost: parsed.stdCost,
    target_margin_pct: parsed.targetMarginPct,
    active: parsed.active,
  }
}
