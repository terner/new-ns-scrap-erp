import { NextResponse } from 'next/server'
import type { Prisma } from '../../../../../generated/prisma/client'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

function assetMonthlyDep(asset: {
  depreciation_method: string | null
  net_asset_cost: Prisma.Decimal | number | null
  salvage_value: Prisma.Decimal | number | null
  useful_life_months: number | null
}) {
  if (asset.depreciation_method === 'No Depreciation' || asset.depreciation_method === 'Manual') return 0
  const usefulLife = asset.useful_life_months || 0
  if (usefulLife <= 0) return 0
  return Math.max(0, (toNumber(asset.net_asset_cost) - toNumber(asset.salvage_value)) / usefulLife)
}

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.financials.view')

    const [assets, depreciations] = await Promise.all([
      prisma.assets.findMany({
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
        select: {
          asset_status: true,
          code: true,
          depreciations: { select: { amount: true } },
          depreciation_method: true,
          id: true,
          name: true,
          net_asset_cost: true,
          salvage_value: true,
          useful_life_months: true,
        },
        take: 5000,
      }),
      prisma.depreciations.findMany({
        include: { assets: { select: { code: true, name: true } } },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        take: 5000,
      }),
    ])

    const pendingAssets = assets
      .map((asset) => {
        const accumDep = asset.depreciations.reduce((sum, dep) => sum + toNumber(dep.amount), 0)
        const netAssetCost = toNumber(asset.net_asset_cost)
        return {
          ...asset,
          accumDep,
          monthlyDep: assetMonthlyDep(asset),
          nbv: Math.max(toNumber(asset.salvage_value), netAssetCost - accumDep),
          netAssetCost,
        }
      })
      .filter((asset) => asset.monthlyDep > 0 && !['Sold', 'Disposed', 'Lost'].includes(asset.asset_status || ''))

    const rows = depreciations.map((dep, index) => {
      const date = toDateOnly(dep.date)
      const period = date.slice(0, 7)
      return {
        accumAfter: toNumber(dep.accumulated),
        assetCode: dep.assets?.code || '-',
        assetName: dep.assets?.name || '-',
        date,
        depreciationAmount: toNumber(dep.amount),
        id: dep.id,
        refNo: `DEP-${period.replace('-', '')}-${String(index + 1).padStart(4, '0')}`,
        nbvAfter: toNumber(dep.nbv),
        period,
        status: 'posted',
      }
    })

    return NextResponse.json({
      designState: {
        runWrite: 'disabled_until_gl_posting_design',
        reverseWrite: 'disabled_until_reversal_design',
      },
      pendingAssets: pendingAssets.map((asset) => ({
        assetStatus: asset.asset_status || 'Active',
        accumDep: asset.accumDep,
        code: asset.code,
        id: asset.id,
        monthlyDep: asset.monthlyDep,
        name: asset.name,
        nbv: asset.nbv,
        netAssetCost: asset.netAssetCost,
      })),
      rows,
      summary: {
        pendingAssets: pendingAssets.length,
        postedRuns: rows.length,
        totalDepreciation: rows.reduce((sum, row) => sum + row.depreciationAmount, 0),
      },
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดค่าเสื่อมราคาไม่ได้', 500)
  }
}
