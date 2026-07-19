import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  fileURLToPath(new URL('./DualCostingManagementPageClient.tsx', import.meta.url)),
  'utf8',
).replaceAll('\r\n', '\n')
const textualColumnClass = 'ns-table-textual-column'

function openingTableCell(sourceText: string, marker: string) {
  const markerIndex = sourceText.indexOf(marker)
  const cellStart = sourceText.lastIndexOf('<TableCell', markerIndex)
  const cellEnd = sourceText.indexOf('>', cellStart)

  expect(markerIndex, marker).toBeGreaterThan(-1)
  expect(cellStart, marker).toBeGreaterThan(-1)
  expect(cellEnd, marker).toBeGreaterThan(cellStart)
  return sourceText.slice(cellStart, cellEnd + 1)
}

describe('Allocation Ledger table density', () => {
  it('uses the shared p-3 body density while keeping loading and empty rows at p-8', () => {
    const viewStart = source.indexOf('function AllocationLedgerView()')
    const viewEnd = source.indexOf('\nfunction compareSortValues', viewStart)
    const view = source.slice(viewStart, viewEnd)
    const rowStart = view.indexOf('{visibleRows.map((row) => (')
    const rowEnd = view.indexOf('</TableRow>', rowStart)
    const ordinaryRow = view.slice(rowStart, rowEnd)
    const ordinaryCells = ordinaryRow.match(/<TableCell className=(?:"[^"]*"|\{`[^`]*`\})/g) ?? []

    expect(viewStart).toBeGreaterThan(-1)
    expect(viewEnd).toBeGreaterThan(viewStart)
    expect(rowStart).toBeGreaterThan(-1)
    expect(rowEnd).toBeGreaterThan(rowStart)
    expect(ordinaryCells).toHaveLength(15)
    ordinaryCells.forEach((cell) => {
      expect(cell).toMatch(/\bp-3\b/)
      expect(cell).not.toMatch(/\bp-2\b/)
    })
    expect(view.match(/className="p-8 text-center text-slate-500"/g)).toHaveLength(2)
  })

  it('applies the textual-column escape hatch to matching headers and body cells', () => {
    const viewStart = source.indexOf('function AllocationLedgerView()')
    const viewEnd = source.indexOf('\nfunction compareSortValues', viewStart)
    const view = source.slice(viewStart, viewEnd)
    const textualColumns = [
      ['matchId', 'title={row.matchId}'],
      ['saleDocNo', 'title={row.saleDocNo}'],
      ['productName', 'title={row.productName}'],
      ['productCategory', '{row.productCategory}'],
      ['costPoolNo', 'title={row.costPoolNo}'],
      ['allocatedBy', 'title={row.allocatedBy}'],
    ] as const

    expect(view).toContain('className={column.className}')
    textualColumns.forEach(([key, bodyMarker]) => {
      expect(view).toMatch(new RegExp(`\\{ key: '${key}',[^\\n]*className: '${textualColumnClass}'`))
      expect(openingTableCell(view, bodyMarker)).toContain(textualColumnClass)
    })
  })
})
