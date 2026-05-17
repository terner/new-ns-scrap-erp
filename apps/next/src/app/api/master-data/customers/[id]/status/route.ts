import { NextResponse } from 'next/server'
import { z } from 'zod'
import { mapPrismaCustomer } from '@/lib/domain/customer'
import { prisma } from '@/lib/server/prisma'

export const runtime = 'nodejs'

const updateCustomerStatusSchema = z.object({
  active: z.boolean(),
})

type CustomerStatusRouteProps = {
  params: Promise<{
    id: string
  }>
}

export async function PATCH(request: Request, { params }: CustomerStatusRouteProps) {
  try {
    const { id } = await params
    const values = updateCustomerStatusSchema.parse(await request.json())

    const customer = await prisma.customers.update({
      where: {
        id,
      },
      data: {
        active: values.active,
      },
    })

    return NextResponse.json(mapPrismaCustomer(customer))
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : 'อัปเดตสถานะลูกค้าไม่ได้' }, { status: 400 })
  }
}
