import * as XLSX from 'xlsx'

export const exportToExcel = (
  rows: Record<string, unknown>[],
  sheetName: string,
  fileName: string,
) => {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, `${fileName}.xlsx`)
}

export interface ExcelSheet {
  name: string
  headerRows?: string[][]
  columns: string[]
  rows: (string | number)[][]
}

export const exportMultiSheetExcel = (sheets: ExcelSheet[], fileName: string) => {
  const workbook = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const data: (string | number)[][] = []

    if (sheet.headerRows) {
      for (const hr of sheet.headerRows) {
        data.push(hr)
      }
    }

    data.push(sheet.columns)

    for (const row of sheet.rows) {
      data.push(row)
    }

    const worksheet = XLSX.utils.aoa_to_sheet(data)

    // Auto column widths based on content
    const colWidths = sheet.columns.map((col, ci) => {
      const maxLen = Math.max(col.length, ...sheet.rows.map((r) => String(r[ci] ?? '').length))
      return { wch: Math.min(maxLen + 4, 60) }
    })
    worksheet['!cols'] = colWidths

    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name)
  }

  XLSX.writeFile(workbook, `${fileName}.xlsx`)
}
