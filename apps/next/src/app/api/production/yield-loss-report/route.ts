import { NextResponse } from 'next/server'
import { apiErrorResponse } from '@/lib/server/api-error'
import { AuthContextError, authContextErrorResponse, getCurrentAuthContext, requirePermission } from '@/lib/server/auth-context'
import { loadProductionMetrics, summarizeProductionMetrics } from '@/lib/server/production-reports'
import { applyWorksheetTableLayout, XLSX } from '@/lib/server/xlsx'

export const runtime = 'nodejs'

type YieldLossRow = Awaited<ReturnType<typeof loadProductionMetrics>>[number] & {
  abnormalLossQty: number
  abnormalLossValue: number
  expectedOutputQty: number
  netPnL: number
  normalLossQty: number
  unitCost: number
  yieldGainQty: number
  yieldGainValue: number
}

function yieldLossSearchText(row: YieldLossRow) {
  return `${row.docNo} ${row.productName} ${row.productCode} ${row.inputProducts} ${row.productionType} ${row.machineName} ${row.branchName}`.toLowerCase()
}

async function buildYieldLossWorkbook(rows: YieldLossRow[]) {
  const workbookRows = rows.map((row) => ({
    เลขที่: row.docNo,
    วันที่: row.date,
    Input: row.inputQty,
    Output: row.outputQty,
    Loss: row.lossQty,
    Yield: row.yieldPct,
    'Loss %': row.lossPct,
    'Normal %': row.normalLossPercent,
    'Loss Value': row.abnormalLossValue,
    Gain: row.yieldGainValue,
    'Net P&L': row.netPnL,
  }))
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(workbookRows)
  const headers = workbookRows[0] ? Object.keys(workbookRows[0]) : []
  sheet['!cols'] = headers.map((header) => ({ wch: Math.max(12, header.length + 4) }))
  applyWorksheetTableLayout(sheet, headers.length, workbookRows.length + 1)
  XLSX.utils.book_append_sheet(workbook, sheet, 'Yield Loss')
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
}

function xlsxResponse(body: Buffer, filename: string) {
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  })
}

export async function GET(request: Request) {
  try {
    const context = await getCurrentAuthContext()
    requirePermission(context, 'production.reports.view')
    const url = new URL(request.url)
    const rows = (await loadProductionMetrics({
      dateFrom: url.searchParams.get('dateFrom') || undefined,
      dateTo: url.searchParams.get('dateTo') || undefined,
    })).map((row) => {
      const unitCost = row.inputQty > 0 ? row.inputCost / row.inputQty : 0
      const normalLossQty = row.inputQty * row.normalLossPercent / 100
      const expectedOutputQty = row.inputQty - normalLossQty
      const abnormalLossQty = Math.max(0, row.lossQty - normalLossQty)
      const yieldGainQty = Math.max(0, row.outputQty - expectedOutputQty)
      const abnormalLossValue = abnormalLossQty * unitCost
      const yieldGainValue = yieldGainQty * unitCost
      return { ...row, abnormalLossQty, abnormalLossValue, expectedOutputQty, netPnL: yieldGainValue - abnormalLossValue, normalLossQty, unitCost, yieldGainQty, yieldGainValue }
    })
    if (url.searchParams.get('format') === 'xlsx') {
      const query = url.searchParams.get('q')?.trim().toLowerCase() ?? ''
      const exportRows = query ? rows.filter((row) => yieldLossSearchText(row).includes(query)) : rows
      return xlsxResponse(await buildYieldLossWorkbook(exportRows), `yield_loss_report_${new Date().toISOString().slice(0, 10)}.xlsx`)
    }
    return NextResponse.json({
      rows,
      summary: {
        ...summarizeProductionMetrics(rows),
        abnormalLossValue: rows.reduce((sum, row) => sum + row.abnormalLossValue, 0),
        netPnL: rows.reduce((sum, row) => sum + row.netPnL, 0),
        yieldGainValue: rows.reduce((sum, row) => sum + row.yieldGainValue, 0),
      },
    })
  } catch (caught) {
    if (caught instanceof AuthContextError) return authContextErrorResponse(caught)
    return apiErrorResponse(caught, 'โหลด Yield/Loss Report ไม่ได้', 500)
  }
}
