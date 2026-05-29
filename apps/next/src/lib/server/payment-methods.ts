import type { MasterDataRecord } from '@/lib/master-data'
import { prisma } from '@/lib/server/prisma'

export type ActivePaymentMethod = Pick<MasterDataRecord, 'name' | 'type'>

export async function getActivePaymentMethods() {
  const rows = await prisma.payment_methods.findMany({
    orderBy: [{ name: 'asc' }],
    select: { name: true, type: true },
    where: { active: true },
  })
  return rows as ActivePaymentMethod[]
}
