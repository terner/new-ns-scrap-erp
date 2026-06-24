import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

const patchSchema = z.object({
  groupId: z.string(),
  branchCode: z.string().trim().nullable().or(z.literal('')),
  notifyWti: z.boolean(),
  notifyWto: z.boolean(),
  isActive: z.boolean(),
})

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
      branchCode: g.branch_code,
      notifyWti: g.notify_wti,
      notifyWto: g.notify_wto,
      isActive: g.is_active,
    }))

    return NextResponse.json({ groups })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดข้อมูลกลุ่ม LINE ไม่สำเร็จ', 500)
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'system.settings.manage')

    const body = await request.json()
    const { groupId, branchCode, notifyWti, notifyWto, isActive } = patchSchema.parse(body)

    const updated = await prisma.line_groups.update({
      where: { group_id: groupId },
      data: {
        branch_code: branchCode || null,
        notify_wti: notifyWti,
        notify_wto: notifyWto,
        is_active: isActive,
        updated_at: new Date(),
      },
    })

    return NextResponse.json({
      groupId: updated.group_id,
      name: updated.name,
      pictureUrl: updated.picture_url,
      branchCode: updated.branch_code,
      notifyWti: updated.notify_wti,
      notifyWto: updated.notify_wto,
      isActive: updated.is_active,
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'อัปเดตการตั้งค่ากลุ่ม LINE ไม่สำเร็จ', 400)
  }
}
