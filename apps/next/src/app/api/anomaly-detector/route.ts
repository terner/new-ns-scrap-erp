import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { buildAnomalyDetector } from '@/lib/server/cash-others-anomaly'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'reports.reports.view')
    const { searchParams } = new URL(request.url)
    return NextResponse.json(await buildAnomalyDetector(searchParams.get('asOf')))
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลด Anomaly Detector ไม่ได้', 500)
  }
}
