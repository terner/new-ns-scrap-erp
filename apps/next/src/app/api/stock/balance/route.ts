import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { buildStockWorkbook, stockBalanceSnapshot, stockReferenceData, xlsxResponse } from '@/lib/server/stock'
import { stockQuerySchema } from '@/lib/stock'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'stock.ledger.view')

    const query = stockQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams))
    const [snapshot, reference] = await Promise.all([
      stockBalanceSnapshot(query),
      stockReferenceData(),
    ])

    if (query.format === 'xlsx') {
      const body = buildStockWorkbook('Stock Balance', snapshot.rows.map((row) => ({
        สินค้า: `${row.productCode} ${row.productName}`.trim(),
        สถานะ: row.status,
        สาขา: row.branchName,
        คลัง: row.warehouseName,
        Lot: row.lotNo,
        คงเหลือ: row.qty,
        มูลค่า: row.value,
        ต้นทุนเฉลี่ย: row.avgCost,
        พร้อมขาย: row.notAvailable ? 'No' : 'Yes',
        ล่าสุด: row.lastDate,
      })))
      return xlsxResponse(body, `stock_balance_${new Date().toISOString().slice(0, 10)}.xlsx`)
    }

    return NextResponse.json({ ...snapshot, reference })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลดสต๊อกคงเหลือไม่ได้', 500)
  }
}
