let xlsxModule = null

async function getXLSX() {
  if (!xlsxModule) {
    xlsxModule = await import('xlsx')
  }
  return xlsxModule
}

/**
 * Reads an uploaded Excel or CSV File object and returns parsed sheet data.
 */
export async function parseExcelFile(file) {
  const XLSX = await getXLSX()
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const result = {
    fileName: file.name,
    sheetNames: workbook.SheetNames,
    sheets: {},
  }

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
    result.sheets[sheetName] = rawRows
  }

  return result
}

/**
 * Parses tab-separated or comma-separated clipboard text (copied from Excel).
 */
export function parsePastedExcelText(text) {
  if (!text || !text.trim()) return []
  const lines = text.trim().split(/\r?\n/)
  if (lines.length === 0) return []

  const separator = lines[0].includes('\t') ? '\t' : ','
  return lines.map((line) => line.split(separator).map((c) => c.trim()))
}
