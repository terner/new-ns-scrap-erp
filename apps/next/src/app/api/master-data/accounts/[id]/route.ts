import { prisma } from '@/lib/server/prisma'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { errorJson, masterDataJson, type MasterDataRouteProps, updateMasterDataStatusSchema, toIso, toNumber } from '@/lib/server/master-data'

export const runtime = 'nodejs'

function normalizeSubtype(row: { currency?: string | null; od_limit?: unknown; subtype?: string | null; type?: string | null }) {
  if (row.subtype === 'savings' || row.subtype === 'current' || row.subtype === 'cash' || row.subtype === 'fcd' || row.subtype === 'od') return row.subtype
  if (row.subtype === 'bank' || row.subtype === 'other') return 'savings'
  if (row.type === 'cash') return 'cash'
  if (Number(row.od_limit ?? 0) > 0) return 'od'
  if (String(row.currency ?? 'THB').toUpperCase() !== 'THB') return 'fcd'
  if (row.type === 'bank' || row.type === 'other') return 'savings'
  return 'savings'
}

export async function PATCH(request: Request, { params }: MasterDataRouteProps) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'master.reference.manage')

    const { id } = await params
    const values = updateMasterDataStatusSchema.parse(await request.json())
    const row = await prisma.accounts.update({ where: { id }, data: { active: values.active }, include: { branches: true } })
    return masterDataJson({ id: row.id, code: null, name: row.name, active: row.active ?? true, type: row.type, subtype: normalizeSubtype(row), phone: null, email: null, note: null, symbol: null, rateToThb: null, parentId: null, channelType: null, bankName: row.bank_name ?? row.bank, bankBranch: row.bank_branch, accountNo: row.account_no, currency: row.currency, openingBalance: toNumber(row.opening_balance), odLimit: toNumber(row.od_limit), branchId: row.branch_id, branchName: row.branches?.name ?? row.branch_id, address: null, commissionPct: null, baseSalary: null, createdAt: toIso(row.created_at), updatedAt: toIso(row.updated_at) })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return errorJson(caught, 'อัปเดตสถานะบัญชีเงินไม่ได้')
  }
}
