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

/**
 * Exports data to an Excel (.xlsx) file and triggers browser download.
 * @param {string} fileName - e.g. "daily_register_2026-11-16.xlsx"
 * @param {Array<{ name: string, data: Array<Object> }>} sheets
 */
export async function exportToExcel(fileName, sheets) {
  const XLSX = await getXLSX()
  const workbook = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.data)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31))
  }

  XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`)
}

/**
 * Downloads a sample template Excel file for quick data entry.
 */
export async function downloadTemplate(type) {
  if (type === 'exit') {
    const sampleData = [
      {
        'Roll No': '25A201',
        Reason: 'Crossed 3 NCs',
        'End Date (YYYY-MM-DD)': '2026-11-20',
        'Until Resolved (TRUE/FALSE)': 'FALSE',
      },
      {
        'Roll No': '25B203',
        Reason: 'Late to college',
        'End Date (YYYY-MM-DD)': '',
        'Until Resolved (TRUE/FALSE)': 'TRUE',
      },
      {
        'Roll No': '25C210',
        Reason: 'Imposition pending',
        'End Date (YYYY-MM-DD)': '',
        'Until Resolved (TRUE/FALSE)': 'TRUE',
      },
    ]
    await exportToExcel('Exit_Restrictions_Template.xlsx', [
      { name: 'Exit Restrictions', data: sampleData },
    ])
  } else if (type === 'entry') {
    const sampleData = [
      {
        'Roll No': '25A201',
        'Pending Subjects (Comma Separated)': 'BS, ECO, STATS',
      },
      {
        'Roll No': '25B203',
        'Pending Subjects (Comma Separated)': 'ALL SUBJECTS',
      },
      {
        'Roll No': '25C210',
        'Pending Subjects (Comma Separated)': 'ACC, KAN',
      },
    ]
    await exportToExcel('Entry_Restrictions_Template.xlsx', [
      { name: 'Entry Restrictions', data: sampleData },
    ])
  } else if (type === 'roster') {
    const sampleData = [
      {
        'Roll No': '26A101',
        'Student Name': 'Sample Student A',
        Grade: 'PU1',
        Section: 'A',
        'Bus Route': 'R4',
      },
      {
        'Roll No': '26B102',
        'Student Name': 'Sample Student B',
        Grade: 'PU1',
        Section: 'B',
        'Bus Route': '',
      },
    ]
    await exportToExcel('Student_Roster_Template.xlsx', [
      { name: 'Students', data: sampleData },
    ])
  }
}
