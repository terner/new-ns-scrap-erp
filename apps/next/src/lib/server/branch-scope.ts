import { getBranchCodeIntersection, type AppAuthContext } from '@/lib/server/auth-context'
import { prisma } from '@/lib/server/prisma'

export async function getAllowedBranchIds(context: AppAuthContext) {
  const allowedCodes = getBranchCodeIntersection(context)
  if (allowedCodes === null) return null
  if (allowedCodes.length === 0) return [] as bigint[]

  const branches = await prisma.branches.findMany({
    select: { id: true },
    where: { code: { in: allowedCodes } },
  })
  return branches.map((branch) => branch.id)
}

export function canAccessBranchId(allowedBranchIds: bigint[] | null, branchId: bigint | null | undefined, options: { allowNull?: boolean } = {}) {
  if (allowedBranchIds === null) return true
  if (branchId == null) return options.allowNull !== false
  return allowedBranchIds.some((allowedBranchId) => allowedBranchId === branchId)
}
