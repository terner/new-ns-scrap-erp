import { NextResponse } from 'next/server'
import { prisma } from '@/lib/server/prisma'
import { getCurrentAuthContext } from '@/lib/server/auth-context'

export const runtime = 'nodejs'

export async function GET() {
  try {
    // ตรวจสอบว่าผู้ใช้งานเข้าสู่ระบบแล้ว (ไม่ต้องการ permission พิเศษ)
    await getCurrentAuthContext()

    const profile = await prisma.company_profiles.findFirst({
      orderBy: [{ branch_code: 'asc' }, { created_at: 'asc' }],
      select: { logo_url: true, name: true },
    })

    return NextResponse.json({
      logoUrl: profile?.logo_url || null,
      name: profile?.name || 'NS Scrap ERP',
    })
  } catch (caught) {
    return NextResponse.json({ logoUrl: null, name: 'NS Scrap ERP' })
  }
}
