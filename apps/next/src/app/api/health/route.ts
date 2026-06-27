import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export function GET() {
  return NextResponse.json({
    ok: true,
    app: 'ns-scrap-erp-next',
    timestamp: new Date().toISOString(),
    // PDF rendering ตอนนี้ใช้ @react-pdf/renderer + @napi-rs/canvas (ไม่ต้องใช้ Chromium binary แล้ว)
    pdf: {
      engine: 'react-pdf',
      note: 'Migrated from Playwright. No browser binary required.',
    },
  })
}
