import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

const routeParamsSchema = z.object({
  id: z.string().uuid(),
})

const adminUserFormSchema = z.object({
  active: z.boolean().default(true),
  branchIds: z.array(z.string().min(1)).default([]),
  displayName: z.string().trim().min(1, 'กรอกชื่อผู้ใช้').max(160, 'ชื่อผู้ใช้ยาวเกินไป'),
  email: z.string().trim().email('รูปแบบอีเมลไม่ถูกต้อง'),
  mustChangePassword: z.boolean().default(false),
  roleIds: z.array(z.string().uuid()).min(1, 'เลือก role อย่างน้อย 1 รายการ'),
  username: z.string().trim()
    .min(3, 'Username ต้องมีอย่างน้อย 3 ตัวอักษร')
    .max(60, 'Username ยาวเกินไป')
    .regex(/^[A-Za-z0-9._-]+$/, 'Username ใช้ได้เฉพาะอังกฤษ ตัวเลข จุด ขีดกลาง และ underscore'),
})

type AdminUserRouteProps = {
  params: Promise<unknown>
}

async function assertUserRefs(roleIds: string[], branchIds: string[]) {
  const [roles, branches] = await Promise.all([
    prisma.app_roles.findMany({
      select: { id: true },
      where: { id: { in: roleIds }, active: true },
    }),
    branchIds.length
      ? prisma.branches.findMany({
          select: { id: true },
          where: { id: { in: branchIds }, active: true },
        })
      : Promise.resolve([]),
  ])

  if (roles.length !== new Set(roleIds).size) {
    throw new Error('Role ที่เลือกไม่ถูกต้องหรือถูกปิดใช้งาน')
  }

  if (branchIds.length && branches.length !== new Set(branchIds).size) {
    throw new Error('สาขาที่เลือกไม่ถูกต้องหรือถูกปิดใช้งาน')
  }
}

export async function PATCH(request: Request, { params }: AdminUserRouteProps) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'system.users.manage')

    const { id } = routeParamsSchema.parse(await params)
    const values = adminUserFormSchema.parse(await request.json())
    await assertUserRefs(values.roleIds, values.branchIds)

    if (context.appUser?.id === id && values.active === false) {
      return NextResponse.json({ error: 'ไม่สามารถปิดบัญชีของตัวเองได้' }, { status: 400 })
    }

    const existing = await prisma.app_users.findFirst({
      where: {
        id: { not: id },
        OR: [
          { username: { equals: values.username, mode: 'insensitive' } },
          { email: { equals: values.email, mode: 'insensitive' } },
        ],
      },
    })

    if (existing) {
      return NextResponse.json({ error: 'Username หรือ email นี้มีอยู่แล้ว' }, { status: 409 })
    }

    const actor = context.appUser?.username ?? context.authUser.email ?? 'system'

    await prisma.$transaction(async (tx) => {
      await tx.app_users.update({
        data: {
          active: values.active,
          display_name: values.displayName,
          email: values.email,
          must_change_password: values.mustChangePassword,
          updated_by: actor,
          username: values.username,
        },
        where: { id },
      })

      await tx.app_user_roles.deleteMany({ where: { user_id: id } })
      await tx.app_user_roles.createMany({
        data: values.roleIds.map((roleId) => ({
          created_by: actor,
          role_id: roleId,
          user_id: id,
        })),
      })

      await tx.app_user_branch_access.deleteMany({ where: { user_id: id } })

      if (values.branchIds.length) {
        await tx.app_user_branch_access.createMany({
          data: values.branchIds.map((branchId) => ({
            branch_id: branchId,
            created_by: actor,
            user_id: id,
          })),
        })
      }
    })

    return NextResponse.json({ id })
  } catch (caught) {
    return authContextErrorResponse(caught)
  }
}
