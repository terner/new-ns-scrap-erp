import * as XLSX from 'xlsx'

export function applyWorksheetTableLayout(sheet: XLSX.WorkSheet, columnCount: number, rowCount: number) {
  if (columnCount <= 0 || rowCount <= 0) return

  const ref = XLSX.utils.encode_range({
    s: { c: 0, r: 0 },
    e: { c: columnCount - 1, r: rowCount - 1 },
  })

  sheet['!autofilter'] = { ref }
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 }
  sheet['!rows'] = [{ hpt: 22 }]
}
