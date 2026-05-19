import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { buildBusinessCalendar } from '@/lib/server/main-calendars'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'reports.reports.view')
    const { searchParams } = new URL(request.url)
    return NextResponse.json(await buildBusinessCalendar(searchParams.get('month')))
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลด Business Calendar ไม่ได้', 500)
  }
}
