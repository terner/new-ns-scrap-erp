import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { buildSalesPlan } from '@/lib/server/main-sales-control'
import { fetchLiveSalesPlanLmeConfig, getSalesPlanLmeConfig, saveSalesPlanLmeConfig } from '@/lib/server/sales-plan-lme'

export const runtime = 'nodejs'

const salesPlanLmeRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('fetch-live') }),
  z.object({
    action: z.literal('save-config'),
    config: z.object({
      fxRate: z.coerce.number().finite().min(0),
      kgPerContainer: z.coerce.number().finite().min(0),
      lmeAluminumUSD: z.coerce.number().finite().min(0),
      lmeBrassUSD: z.coerce.number().finite().min(0),
      lmeCopperUSD: z.coerce.number().finite().min(0),
      liveFetchNote: z.string().trim().max(500).default(''),
      source: z.enum(['default', 'live', 'manual', 'mixed']).default('manual'),
    }),
  }),
])

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'reports.reports.view')
    return NextResponse.json(await buildSalesPlan())
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดแผนการขายไม่ได้', 500)
  }
}

export async function POST(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'reports.reports.view')

    const payload = salesPlanLmeRequestSchema.parse(await request.json())
    if (payload.action === 'fetch-live') {
      const currentConfig = await getSalesPlanLmeConfig()
      return NextResponse.json({
        lmeConfig: {
          ...await fetchLiveSalesPlanLmeConfig(currentConfig),
          updatedAt: currentConfig.updatedAt,
          updatedBy: currentConfig.updatedBy,
        },
      })
    }

    const config = await saveSalesPlanLmeConfig(payload.config, context)
    return NextResponse.json({ lmeConfig: config })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'อัปเดต LME Reference Pricing ไม่ได้', 500)
  }
}
