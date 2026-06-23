import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'system.settings.manage')

    const dbGroups = await prisma.line_groups.findMany({
      orderBy: {
        updated_at: 'desc',
      },
    })

    const groups = dbGroups.map((g) => ({
      groupId: g.group_id,
      name: g.name,
      pictureUrl: g.picture_url,
    }))

    return NextResponse.json({ groups })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดข้อมูลกลุ่ม LINE ไม่สำเร็จ', 500)
  }
}
