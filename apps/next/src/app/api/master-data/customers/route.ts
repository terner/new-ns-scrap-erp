import { NextResponse } from 'next/server'
import { customerFormSchema } from '@/lib/customer'
import { mapPrismaCustomer, toCustomerWriteInput } from '@/lib/domain/customer'
import { prisma } from '@/lib/server/prisma'
import type { Prisma } from '../../../../../generated/prisma/client'

export const runtime = 'nodejs'

const sortColumns = {
  active: 'active',
  code: 'code',
  contact: 'contact',
  creditLimit: 'credit_limit',
  creditTerm: 'credit_term',
  email: 'email',
  name: 'name',
  phone: 'phone',
  taxId: 'tax_id',
  type: 'type',
} as const

function parseListParams(request: Request) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1)
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get('pageSize') ?? '25') || 25))
  const q = url.searchParams.get('q')?.trim() ?? ''
  const sort = url.searchParams.get('sort') ?? 'code'
  const direction = url.searchParams.get('direction') === 'desc' ? 'desc' : 'asc'
  const sortColumn = sortColumns[sort as keyof typeof sortColumns] ?? sortColumns.code

  return { direction, page, pageSize, q, sortColumn }
}

function customerSearchWhere(q: string): Prisma.customersWhereInput {
  if (!q) return {}

  return {
    OR: [
      { id: { contains: q, mode: 'insensitive' } },
      { code: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { type: { contains: q, mode: 'insensitive' } },
      { tax_id: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { address: { contains: q, mode: 'insensitive' } },
      { contact: { contains: q, mode: 'insensitive' } },
      { sales_id: { contains: q, mode: 'insensitive' } },
      { notes: { contains: q, mode: 'insensitive' } },
    ],
  }
}

async function getNextCustomerCode() {
  const lastCustomer = await prisma.customers.findFirst({
    where: {
      code: {
        startsWith: 'CUS',
      },
    },
    orderBy: {
      code: 'desc',
    },
    select: {
      code: true,
    },
  })

  const lastNumber = Number(String(lastCustomer?.code ?? '').replace(/^CUS/i, ''))
  const nextNumber = Number.isFinite(lastNumber) ? lastNumber + 1 : 1
  return `CUS${String(nextNumber).padStart(3, '0')}`
}

export async function GET(request: Request) {
  try {
    const { direction, page, pageSize, q, sortColumn } = parseListParams(request)
    const where = customerSearchWhere(q)
    const [customers, total] = await Promise.all([
      prisma.customers.findMany({
        orderBy: [{ [sortColumn]: direction }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        where,
      }),
      prisma.customers.count({ where }),
    ])

    return NextResponse.json({
      rows: customers.map(mapPrismaCustomer),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    })
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : 'โหลดข้อมูลลูกค้าไม่ได้' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const values = customerFormSchema.parse(body)
    const code = values.id ? values.code : await getNextCustomerCode()
    const payload = toCustomerWriteInput({ ...values, code })

    const customer = await prisma.customers.upsert({
      where: {
        id: payload.id,
      },
      create: payload,
      update: payload,
    })

    return NextResponse.json(mapPrismaCustomer(customer))
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : 'บันทึกข้อมูลลูกค้าไม่ได้' }, { status: 400 })
  }
}
