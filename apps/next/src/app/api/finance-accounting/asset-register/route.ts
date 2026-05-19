import { NextResponse } from 'next/server'
import type { Prisma } from '../../../../../generated/prisma/client'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

type AssetRow = Prisma.assetsGetPayload<{
  include: {
    branches: { select: { name: true } }
    depreciations: true
    suppliers: { select: { name: true } }
  }
}>

function monthlyDep(asset: AssetRow) {
  const method = asset.depreciation_method || 'Straight Line'
  if (method === 'No Depreciation' || method === 'Manual') return 0
  const usefulLife = asset.useful_life_months || 0
  if (usefulLife <= 0) return 0
  return Math.max(0, (toNumber(asset.net_asset_cost) - toNumber(asset.salvage_value)) / usefulLife)
}

function mapAsset(asset: AssetRow) {
  const accumDep = asset.depreciations.reduce((sum, dep) => sum + toNumber(dep.amount), 0)
  const netAssetCost = toNumber(asset.net_asset_cost) || (toNumber(asset.original_cost) - toNumber(asset.vat_amount))
  const nbv = Math.max(toNumber(asset.salvage_value), netAssetCost - accumDep)
  return {
    accumDep,
    assetStatus: asset.asset_status || 'Active',
    branchName: asset.branches?.name || '-',
    category: asset.category || '-',
    code: asset.code,
    id: asset.id,
    location: asset.location || '',
    monthlyDep: monthlyDep(asset),
    name: asset.name,
    nbv,
    netAssetCost,
    originalCost: toNumber(asset.original_cost),
    purchaseDate: toDateOnly(asset.purchase_date),
    salvageValue: toNumber(asset.salvage_value),
    serialNo: asset.serial_no || '',
    usefulLifeMonths: asset.useful_life_months || 0,
    vatAmount: toNumber(asset.vat_amount),
  }
}

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.financials.view')

    const assets = await prisma.assets.findMany({
      include: {
        branches: { select: { name: true } },
        depreciations: true,
        suppliers: { select: { name: true } },
      },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      take: 5000,
    })

    const rows = assets.map(mapAsset)
    const categories = Array.from(new Set(rows.map((row) => row.category))).sort()
    const statuses = Array.from(new Set(rows.map((row) => row.assetStatus))).sort()
    const byCategory = categories.map((category) => {
      const items = rows.filter((row) => row.category === category)
      return {
        category,
        count: items.length,
        cost: items.reduce((sum, row) => sum + row.netAssetCost, 0),
        monthlyDep: items.reduce((sum, row) => sum + row.monthlyDep, 0),
        nbv: items.reduce((sum, row) => sum + row.nbv, 0),
      }
    })

    return NextResponse.json({
      filters: { categories, statuses },
      rows,
      summary: {
        accumDep: rows.reduce((sum, row) => sum + row.accumDep, 0),
        count: rows.length,
        monthlyDep: rows.reduce((sum, row) => sum + row.monthlyDep, 0),
        nbv: rows.reduce((sum, row) => sum + row.nbv, 0),
        netAssetCost: rows.reduce((sum, row) => sum + row.netAssetCost, 0),
      },
      byCategory,
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดทะเบียนทรัพย์สินไม่ได้', 500)
  }
}
