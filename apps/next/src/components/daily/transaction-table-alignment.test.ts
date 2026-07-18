import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function readSource(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8').replaceAll('\r\n', '\n')
}

const transactionBillsSource = readSource('./TransactionBillsPageClient.tsx')
const purchaseBillsSource = readSource('../purchase-flow/PurchaseBillsPageClient.tsx')
const receiptVouchersSource = readSource('./ReceiptVouchersPageClient.tsx')
const weightTicketDashboardSource = readSource('./WeightTicketDashboardPageClient.tsx')
const weightTicketListSource = readSource('./WeightTicketListPageClient.tsx')
const poSellSource = readSource('../sales/PoSellPageClient.tsx')
const advancePaymentsSource = readSource('../purchase-flow/AdvancePaymentsPageClient.tsx')
const resizableTableHeadSource = readSource('../ui/ResizableTableHead.tsx')
const salesBillsRouteSource = readSource('../../app/sales/bills/page.tsx')

function openingTag(source: string, tagName: string, marker: string) {
  const markerIndex = source.indexOf(marker)
  expect(markerIndex, `missing marker: ${marker}`).toBeGreaterThan(-1)
  const tagStart = source.lastIndexOf(`<${tagName}`, markerIndex)
  const tagEnd = source.indexOf('>', markerIndex)
  expect(tagStart, `missing <${tagName}> for: ${marker}`).toBeGreaterThan(-1)
  expect(tagEnd, `missing closing > for: ${marker}`).toBeGreaterThan(tagStart)
  return source.slice(tagStart, tagEnd + 1)
}

function expectLeftAlignedColumn({
  bodyMarker,
  bodyTagName,
  defaultAlignmentSource,
  headerMarker,
  headerTagName,
  source,
}: {
  bodyMarker: string
  bodyTagName: 'TableCell' | 'td'
  defaultAlignmentSource?: string
  headerMarker: string
  headerTagName: 'AdvancePaymentSortHeader' | 'ResizableTableHead' | 'SortHeader'
  source: string
}) {
  const headerTag = openingTag(source, headerTagName, headerMarker)
  const bodyTag = openingTag(source, bodyTagName, bodyMarker)

  expect(headerTag).not.toMatch(/align="(?:center|right)"/)
  if (!headerTag.includes('align="left"')) {
    expect(defaultAlignmentSource).toContain("align = 'left'")
  }
  expect(bodyTag).not.toMatch(/(?:justify|text)-(?:center|end|right)/)
}

describe('transaction bill detail table', () => {
  it('shows the captured unit cost between net quantity and sale price', () => {
    const netQuantityHeader = transactionBillsSource.indexOf('>จำนวนสุทธิ</th>')
    const unitCostHeader = transactionBillsSource.indexOf('>ต้นทุน/หน่วย</th>')
    const salePriceHeader = transactionBillsSource.indexOf('>ราคาขาย/หน่วย</th>', netQuantityHeader)
    const detailTableStart = transactionBillsSource.lastIndexOf('<table', netQuantityHeader)
    const detailTableEnd = transactionBillsSource.indexOf('</table>', netQuantityHeader)
    const detailTableSource = transactionBillsSource.slice(detailTableStart, detailTableEnd)

    expect(netQuantityHeader).toBeGreaterThan(-1)
    expect(unitCostHeader).toBeGreaterThan(netQuantityHeader)
    expect(salePriceHeader).toBeGreaterThan(unitCostHeader)
    expect(detailTableStart).toBeGreaterThan(-1)
    expect(detailTableEnd).toBeGreaterThan(salePriceHeader)
    expect(detailTableSource).toContain("item.unitCostSnapshot == null ? '-' : formatMoney(item.unitCostSnapshot)")
    expect(detailTableSource).toContain('min-w-[1240px]')
    expect(detailTableSource).toContain('colSpan={10}>ไม่มีรายการสินค้าในบิล')
  })
})

describe('accepted textual table alignment', () => {
  it('left-aligns the Supplier column on /purchase/bills', () => {
    expect(purchaseBillsSource).toContain('<TransactionBillsPageClient mode="purchase" />')
    expectLeftAlignedColumn({
      bodyMarker: "'supplierName' in row ? row.supplierName : row.customerName",
      bodyTagName: 'td',
      headerMarker: "getResizeHandleProps('partyName', mode === 'purchase' ? 'ผู้ขาย' : 'ลูกค้า')",
      headerTagName: 'SortHeader',
      source: transactionBillsSource,
    })
  })

  it('left-aligns the Customer column on /sales/bills', () => {
    expect(salesBillsRouteSource).toContain('<TransactionBillsPageClient mode="sales" />')
    expectLeftAlignedColumn({
      bodyMarker: "'supplierName' in row ? row.supplierName : row.customerName",
      bodyTagName: 'td',
      headerMarker: "getResizeHandleProps('partyName', mode === 'purchase' ? 'ผู้ขาย' : 'ลูกค้า')",
      headerTagName: 'SortHeader',
      source: transactionBillsSource,
    })
  })

  it('left-aligns the payee column on /purchase/receipt-vouchers', () => {
    expectLeftAlignedColumn({
      bodyMarker: 'className="p-2 font-medium text-slate-800">{row.sellerName',
      bodyTagName: 'td',
      defaultAlignmentSource: resizableTableHeadSource,
      headerMarker: "getResizeHandleProps('sellerName', 'ผู้รับเงิน')",
      headerTagName: 'ResizableTableHead',
      source: receiptVouchersSource,
    })
  })

  it('left-aligns the WTO party column on /daily/weight-ticket-dashboard', () => {
    expectLeftAlignedColumn({
      bodyMarker: 'title={row.partyName}>{row.partyName}</div>',
      bodyTagName: 'td',
      defaultAlignmentSource: resizableTableHeadSource,
      headerMarker: "getResizeHandleProps('party', 'คู่ค้า')",
      headerTagName: 'ResizableTableHead',
      source: weightTicketDashboardSource,
    })
  })

  it('left-aligns the created date and Supplier columns on /daily/weight-ticket-list', () => {
    expectLeftAlignedColumn({
      bodyMarker: '{ticketDate}</div>',
      bodyTagName: 'td',
      headerMarker: "getResizeHandleProps('createdAt', 'วันที่สร้าง')",
      headerTagName: 'SortHeader',
      source: weightTicketListSource,
    })
    expectLeftAlignedColumn({
      bodyMarker: '>{ticket.partyName}</td>',
      bodyTagName: 'td',
      headerMarker: "getResizeHandleProps('partyName', typeFilter === 'WTI' ? 'ผู้ขาย' : 'ลูกค้า')",
      headerTagName: 'SortHeader',
      source: weightTicketListSource,
    })
  })

  it('left-aligns the Customer column on /sales/po-sell', () => {
    expectLeftAlignedColumn({
      bodyMarker: 'className="truncate">{row.customerName}',
      bodyTagName: 'TableCell',
      defaultAlignmentSource: resizableTableHeadSource,
      headerMarker: "getResizeHandleProps('customerName', 'ลูกค้า')",
      headerTagName: 'ResizableTableHead',
      source: poSellSource,
    })
  })

  it('left-aligns the Supplier column on /purchase/advance-payments', () => {
    expectLeftAlignedColumn({
      bodyMarker: 'className="p-3 font-medium text-slate-700">{row.supplierName}',
      bodyTagName: 'td',
      defaultAlignmentSource: advancePaymentsSource,
      headerMarker: "getResizeHandleProps('supplierName', 'ผู้ขาย')",
      headerTagName: 'AdvancePaymentSortHeader',
      source: advancePaymentsSource,
    })
  })
})
