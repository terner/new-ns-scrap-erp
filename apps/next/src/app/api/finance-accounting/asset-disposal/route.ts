import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { toDateOnly, toNumber } from '@/lib/server/daily'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'finance.financials.view')

    const assets = await prisma.assets.findMany({
      include: { depreciations: true },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
      take: 5000,
    })

    const assetOptions = assets
      .filter((asset) => !['Sold', 'Disposed', 'Lost'].includes(asset.asset_status || ''))
      .map((asset) => {
        const accumDep = asset.depreciations.reduce((sum, dep) => sum + toNumber(dep.amount), 0)
        const netAssetCost = toNumber(asset.net_asset_cost) || (toNumber(asset.original_cost) - toNumber(asset.vat_amount))
        return {
          assetStatus: asset.asset_status || 'Active',
          code: asset.code,
          id: asset.id,
          label: `${asset.code} - ${asset.name}`,
          name: asset.name,
          nbv: Math.max(toNumber(asset.salvage_value), netAssetCost - accumDep),
          purchaseDate: toDateOnly(asset.purchase_date),
        }
      })

    return NextResponse.json({
      assetOptions,
      designState: {
        disposalTable: 'not_available',
        writeBehavior: 'read_design_only_no_asset_status_or_gl_mutation',
      },
      rows: [],
      summary: {
        activeAssets: assetOptions.length,
        disposedRows: 0,
        gainLoss: 0,
        proceeds: 0,
      },
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดข้อมูลจำหน่ายทรัพย์สินไม่ได้', 500)
  }
}
