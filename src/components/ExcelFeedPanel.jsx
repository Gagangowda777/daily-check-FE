import { useState, useRef } from 'react'
import { api } from '../lib/api.js'
import { parseExcelFile, parsePastedExcelText } from '../lib/excel.js'
import '../excel-feed.css'

export default function ExcelFeedPanel({ date, onChanged }) {
  const [category, setCategory] = useState('exit') // 'exit' | 'entry' | 'roster'
  const [activeTab, setActiveTab] = useState('upload') // 'upload' | 'paste' | 'grid' | 'student'

  // Upload & Preview state
  const [file, setFile] = useState(null)
  const [parsedRows, setParsedRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [importSummary, setImportSummary] = useState(null)

  // Paste state
  const [pastedText, setPastedText] = useState('')

  // Quick Grid state
  const [gridRows, setGridRows] = useState([
    { rollNo: '', reasonOrSubjects: 'Crossed 3 NCs', untilResolved: true, endDate: '' },
    { rollNo: '', reasonOrSubjects: 'Crossed 3 NCs', untilResolved: true, endDate: '' },
    { rollNo: '', reasonOrSubjects: 'Crossed 3 NCs', untilResolved: true, endDate: '' },
  ])

  // Single Student state
  const [newStudent, setNewStudent] = useState({
    rollNo: '',
    name: '',
    grade: 'PU1',
    section: 'A',
    busRoute: '',
  })

  const fileInputRef = useRef(null)

  // Reset parsed rows when changing category
  const handleCategoryChange = (cat) => {
    setCategory(cat)
    setParsedRows([])
    setFile(null)
    setError('')
    setNotice('')
    setImportSummary(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Normalize column keys from uploaded or pasted tables
  const normalizeKey = (key = '') =>
    String(key).toLowerCase().replace(/[^a-z0-9]/g, '')

  const mapRowData = (rawObj) => {
    const keys = Object.keys(rawObj)
    const getVal = (possibleNames) => {
      for (const name of possibleNames) {
        const foundKey = keys.find((k) => normalizeKey(k) === normalizeKey(name))
        if (foundKey && rawObj[foundKey] !== undefined && rawObj[foundKey] !== '') {
          return String(rawObj[foundKey]).trim()
        }
      }
      return ''
    }

    const rollNo = getVal(['roll no', 'rollno', 'rn', 'roll_no', 'roll'])
    const name = getVal(['student name', 'name', 'student_name'])
    const reason = getVal(['reason', 'restriction reason', 'cause', 'remarks'])
    const subjects = getVal(['pending subjects', 'noc pending', 'subjects', 'noc'])
    const section = getVal(['section', 'sec', 'class'])
    const grade = getVal(['grade', 'pu'])
    const busRoute = getVal(['bus route', 'bus', 'route'])
    const endDate = getVal(['end date', 'end_date', 'until date'])
    const untilResolvedVal = getVal(['until resolved', 'until_resolved', 'resolved'])

    return {
      rollNo: rollNo.toUpperCase(),
      name,
      reason: reason || 'Crossed 3 NCs',
      subjects: subjects || 'All Subjects',
      section: section.toUpperCase(),
      grade: grade.toUpperCase(),
      busRoute: busRoute.toUpperCase(),
      endDate,
      untilResolved:
        String(untilResolvedVal).toLowerCase() === 'true' ||
        String(untilResolvedVal) === '1' ||
        !endDate,
    }
  }

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError('')
    setNotice('')
    setImportSummary(null)

    try {
      const data = await parseExcelFile(selectedFile)
      // Pick first sheet
      const firstSheetName = data.sheetNames[0]
      const rawRows = data.sheets[firstSheetName] || []

      const mapped = rawRows
        .map(mapRowData)
        .filter((r) => r.rollNo && r.rollNo.length >= 3)

      if (mapped.length === 0) {
        throw new Error(
          'No valid student rows detected. Ensure the sheet has a "Roll No" column.'
        )
      }

      setParsedRows(mapped)
      setNotice(
        `Parsed ${mapped.length} row(s) from sheet "${firstSheetName}". Review below and confirm import.`
      )
    } catch (err) {
      setError(err.message || 'Failed to parse Excel file.')
      setParsedRows([])
    }
  }

  const handleParsePasted = () => {
    if (!pastedText.trim()) return
    setError('')
    setNotice('')
    setImportSummary(null)

    try {
      const table = parsePastedExcelText(pastedText)
      if (table.length === 0) throw new Error('No data found in clipboard paste.')

      // Check if first row is header
      const firstRow = table[0].map(normalizeKey)
      const hasHeader =
        firstRow.includes('rollno') ||
        firstRow.includes('rn') ||
        firstRow.includes('roll')

      const dataRows = hasHeader ? table.slice(1) : table

      const mapped = dataRows
        .map((row) => {
          const rollNo = (row[0] || '').trim().toUpperCase()
          const secondary = (row[1] || '').trim()
          const tertiary = (row[2] || '').trim()

          return {
            rollNo,
            reason: secondary || 'Crossed 3 NCs',
            subjects: secondary || 'All Subjects',
            name: tertiary,
            section: '',
            grade: '',
            busRoute: '',
            untilResolved: true,
            endDate: '',
          }
        })
        .filter((r) => r.rollNo && r.rollNo.length >= 3)

      if (mapped.length === 0) {
        throw new Error(
          'Could not detect valid roll numbers. Paste rows containing Roll Numbers.'
        )
      }

      setParsedRows(mapped)
      setNotice(`Parsed ${mapped.length} row(s). Review below and confirm import.`)
    } catch (err) {
      setError(err.message)
    }
  }

  // Execute Bulk Import to Backend
  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) return
    setBusy(true)
    setError('')
    setNotice('')

    try {
      if (category === 'exit') {
        const payload = {
          date,
          rows: parsedRows.map((r) => ({
            rollNo: r.rollNo,
            reason: r.reason,
            endDate: r.endDate || null,
            untilResolved: r.untilResolved,
          })),
        }
        const res = await api.bulkExitRestrictions(payload)
        setImportSummary(res)
        setNotice(
          `Successfully imported ${res.count} exit restriction(s) for ${date}!`
        )
      } else if (category === 'entry') {
        const payload = {
          date,
          rows: parsedRows.map((r) => ({
            rollNo: r.rollNo,
            subjects: r.subjects,
          })),
        }
        const res = await api.bulkEntryRestrictions(payload)
        setImportSummary(res)
        setNotice(
          `Successfully imported ${res.count} entry restriction(s) for ${date}!`
        )
      } else if (category === 'roster') {
        const payload = {
          rows: parsedRows.map((r) => ({
            rollNo: r.rollNo,
            name: r.name || `Student ${r.rollNo}`,
            grade: r.grade || 'PU1',
            section: r.section || 'A',
            busRoute: r.busRoute || null,
          })),
        }
        const res = await api.bulkStudents(payload)
        setImportSummary(res)
        setNotice(
          `Successfully imported / updated ${res.count} student(s) on master roster!`
        )
      }

      setParsedRows([])
      setFile(null)
      setPastedText('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (onChanged) onChanged()
    } catch (err) {
      setError(err.message || 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  // Handle Quick Grid submission
  const handleSaveGrid = async () => {
    const valid = gridRows.filter((r) => r.rollNo && r.rollNo.trim().length >= 3)
    if (valid.length === 0) {
      setError('Enter at least one valid student roll number in the grid.')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    setImportSummary(null)
    try {
      if (category === 'exit') {
        const res = await api.bulkExitRestrictions({
          date,
          rows: valid.map((r) => ({
            rollNo: r.rollNo.trim().toUpperCase(),
            reason: r.reasonOrSubjects,
            untilResolved: r.untilResolved,
            endDate: r.untilResolved ? null : r.endDate || date,
          })),
        })
        setImportSummary(res)
        setNotice(`Added ${res.count} exit restrictions!`)
      } else if (category === 'entry') {
        const res = await api.bulkEntryRestrictions({
          date,
          rows: valid.map((r) => ({
            rollNo: r.rollNo.trim().toUpperCase(),
            subjects: r.reasonOrSubjects,
          })),
        })
        setImportSummary(res)
        setNotice(`Added ${res.count} entry restrictions!`)
      }

      setGridRows([
        { rollNo: '', reasonOrSubjects: 'Crossed 3 NCs', untilResolved: true, endDate: '' },
        { rollNo: '', reasonOrSubjects: 'Crossed 3 NCs', untilResolved: true, endDate: '' },
      ])
      if (onChanged) onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Add single student form submit
  const handleAddSingleStudent = async (e) => {
    e.preventDefault()
    if (!newStudent.rollNo.trim() || !newStudent.name.trim()) {
      setError('Roll number and Student Name are required.')
      return
    }

    setBusy(true)
    setError('')
    try {
      await api.addStudent(newStudent)
      setNotice(`Student ${newStudent.name} (${newStudent.rollNo}) successfully added!`)
      setNewStudent({
        rollNo: '',
        name: '',
        grade: 'PU1',
        section: 'A',
        busRoute: '',
      })
      if (onChanged) onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="excel-feed-panel">
      {/* Category selector */}
      <div className="excel-category-bar">
        <div>
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#0b1220' }}>
            Data Feed Category:
          </span>
          <div className="excel-category-pills" style={{ marginTop: '6px' }}>
            <button
              type="button"
              className={`excel-cat-pill ${category === 'exit' ? 'is-active' : ''}`}
              onClick={() => handleCategoryChange('exit')}
            >
              Exit Restrictions (Crossed 3 NCs, etc.)
            </button>
            <button
              type="button"
              className={`excel-cat-pill ${category === 'entry' ? 'is-active' : ''}`}
              onClick={() => handleCategoryChange('entry')}
            >
              Entry Restrictions (NOC Pending)
            </button>
            <button
              type="button"
              className={`excel-cat-pill ${category === 'roster' ? 'is-active' : ''}`}
              onClick={() => handleCategoryChange('roster')}
            >
              Student Roster / Master Data
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="excel-feed-tabs">
        <button
          type="button"
          className={`excel-tab-btn ${activeTab === 'upload' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          📁 Upload Excel / CSV File
        </button>
        <button
          type="button"
          className={`excel-tab-btn ${activeTab === 'paste' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('paste')}
        >
          📋 Copy-Paste from Excel
        </button>
        {category !== 'roster' && (
          <button
            type="button"
            className={`excel-tab-btn ${activeTab === 'grid' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('grid')}
          >
            ⚡ Quick Grid Feeder
          </button>
        )}
        {category === 'roster' && (
          <button
            type="button"
            className={`excel-tab-btn ${activeTab === 'student' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('student')}
          >
            + Add Single Student
          </button>
        )}
      </div>

      {/* Alerts */}
      {notice && <div className="notice-banner">{notice}</div>}
      {error && <div className="error-banner">{error}</div>}

      {/* TAB 1: FILE UPLOAD */}
      {activeTab === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label
            className={`excel-dropzone ${file ? 'has-file' : ''}`}
            htmlFor="excel-file-input"
          >
            <svg
              className="excel-drop-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
            <span className="excel-drop-text">
              {file
                ? `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`
                : 'Click or drag Excel (.xlsx, .xls) or CSV file here to feed data'}
            </span>
            <span className="excel-drop-hint">
              Supports standard column headers like "Roll No" / "RN", "Reason", "NOC Pending", "Name"
            </span>
            <input
              id="excel-file-input"
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </label>
        </div>
      )}

      {/* TAB 2: PASTE FROM EXCEL */}
      {activeTab === 'paste' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '13px', color: '#475467' }}>
            In Excel, select and copy the columns (e.g. <strong>Roll No</strong> and{' '}
            <strong>{category === 'exit' ? 'Reason' : 'Subjects'}</strong>), then paste them below:
          </p>
          <textarea
            className="excel-paste-box"
            rows={8}
            placeholder={`Example paste:\n25A201\tCrossed 3 NCs\n25B203\tLate to college\n25C210\tImposition pending`}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />
          <div>
            <button
              type="button"
              className="excel-btn-primary"
              disabled={!pastedText.trim()}
              onClick={handleParsePasted}
            >
              Parse Clipboard Data
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: QUICK GRID FEEDER */}
      {activeTab === 'grid' && category !== 'roster' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '13px', color: '#475467' }}>
            Quick multi-row spreadsheet entry. Type student roll numbers and specify details:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="feed-grid-row" style={{ fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', color: '#8a94a6' }}>
              <span>Roll Number</span>
              <span>{category === 'exit' ? 'Restriction Reason' : 'Pending Subjects'}</span>
              <span>{category === 'exit' ? 'Duration' : 'Notes'}</span>
              <span></span>
            </div>

            {gridRows.map((row, idx) => (
              <div key={idx} className="feed-grid-row">
                <input
                  type="text"
                  className="gate-filter-input"
                  placeholder="e.g. 25A201"
                  value={row.rollNo}
                  onChange={(e) => {
                    const next = [...gridRows]
                    next[idx].rollNo = e.target.value
                    setGridRows(next)
                  }}
                />

                <input
                  type="text"
                  className="gate-filter-input"
                  placeholder={
                    category === 'exit'
                      ? 'e.g. Crossed 3 NCs'
                      : 'e.g. BS, ECO, STATS'
                  }
                  value={row.reasonOrSubjects}
                  onChange={(e) => {
                    const next = [...gridRows]
                    next[idx].reasonOrSubjects = e.target.value
                    setGridRows(next)
                  }}
                />

                {category === 'exit' ? (
                  <select
                    className="gate-filter-select"
                    value={row.untilResolved ? 'resolved' : 'today'}
                    onChange={(e) => {
                      const next = [...gridRows]
                      next[idx].untilResolved = e.target.value === 'resolved'
                      setGridRows(next)
                    }}
                  >
                    <option value="resolved">Until resolved</option>
                    <option value="today">Today only</option>
                  </select>
                ) : (
                  <span style={{ fontSize: '12px', color: '#8a94a6' }}>NOC Pending</span>
                )}

                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    cursor: 'pointer',
                    fontWeight: 800,
                  }}
                  title="Remove row"
                  onClick={() => {
                    if (gridRows.length > 1) {
                      setGridRows(gridRows.filter((_, i) => i !== idx))
                    }
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button
              type="button"
              className="excel-btn-secondary"
              onClick={() =>
                setGridRows([
                  ...gridRows,
                  { rollNo: '', reasonOrSubjects: category === 'exit' ? 'Crossed 3 NCs' : 'All Subjects', untilResolved: true, endDate: '' },
                ])
              }
            >
              + Add Row
            </button>
            <button
              type="button"
              className="excel-btn-secondary"
              onClick={() =>
                setGridRows([
                  ...gridRows,
                  ...Array.from({ length: 5 }, () => ({
                    rollNo: '',
                    reasonOrSubjects: category === 'exit' ? 'Crossed 3 NCs' : 'All Subjects',
                    untilResolved: true,
                    endDate: '',
                  })),
                ])
              }
            >
              + Add 5 Rows
            </button>
            <button
              type="button"
              className="excel-btn-primary"
              disabled={busy}
              onClick={handleSaveGrid}
            >
              {busy ? 'Saving…' : `Submit All Grid Rows for ${date}`}
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: ADD SINGLE STUDENT */}
      {activeTab === 'student' && category === 'roster' && (
        <form onSubmit={handleAddSingleStudent} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '520px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Roll Number *</label>
              <input
                type="text"
                className="gate-filter-input"
                style={{ width: '100%', marginTop: '4px' }}
                placeholder="e.g. 26A199"
                required
                value={newStudent.rollNo}
                onChange={(e) => setNewStudent({ ...newStudent, rollNo: e.target.value })}
              />
            </div>
            <div style={{ flex: 1.5 }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Student Name *</label>
              <input
                type="text"
                className="gate-filter-input"
                style={{ width: '100%', marginTop: '4px' }}
                placeholder="e.g. Rahul Sharma"
                required
                value={newStudent.name}
                onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Grade</label>
              <select
                className="gate-filter-select"
                style={{ width: '100%', marginTop: '4px' }}
                value={newStudent.grade}
                onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
              >
                <option value="PU1">PU1 (11th)</option>
                <option value="PU2">PU2 (12th)</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Section</label>
              <input
                type="text"
                className="gate-filter-input"
                style={{ width: '100%', marginTop: '4px' }}
                placeholder="e.g. A"
                required
                value={newStudent.section}
                onChange={(e) => setNewStudent({ ...newStudent, section: e.target.value.toUpperCase() })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Bus Route</label>
              <input
                type="text"
                className="gate-filter-input"
                style={{ width: '100%', marginTop: '4px' }}
                placeholder="e.g. R5 or None"
                value={newStudent.busRoute}
                onChange={(e) => setNewStudent({ ...newStudent, busRoute: e.target.value.toUpperCase() })}
              />
            </div>
          </div>

          <div>
            <button type="submit" className="excel-btn-primary" disabled={busy}>
              {busy ? 'Adding…' : '+ Add Student to Master Roster'}
            </button>
          </div>
        </form>
      )}

      {/* PREVIEW OF PARSED ROWS (For Upload & Paste) */}
      {parsedRows.length > 0 && (
        <div className="excel-preview-wrap">
          <div className="excel-preview-head">
            <span className="excel-preview-title">
              Data Preview ({parsedRows.length} valid rows detected)
            </span>
            <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 700 }}>
              Ready to feed into Daily Check
            </span>
          </div>

          <div className="excel-table-scroll">
            <table className="excel-preview-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Roll No</th>
                  {category === 'roster' ? (
                    <>
                      <th>Student Name</th>
                      <th>Grade</th>
                      <th>Section</th>
                      <th>Bus Route</th>
                    </>
                  ) : category === 'exit' ? (
                    <>
                      <th>Reason</th>
                      <th>Duration</th>
                    </>
                  ) : (
                    <>
                      <th>Pending Subjects</th>
                    </>
                  )}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 100).map((row, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>
                      <strong>{row.rollNo}</strong>
                    </td>
                    {category === 'roster' ? (
                      <>
                        <td>{row.name || '—'}</td>
                        <td>{row.grade || 'PU1'}</td>
                        <td>{row.section || 'A'}</td>
                        <td>{row.busRoute || 'None'}</td>
                      </>
                    ) : category === 'exit' ? (
                      <>
                        <td style={{ color: '#b91c1c', fontWeight: 600 }}>{row.reason}</td>
                        <td style={{ fontSize: '12px', color: '#64748b' }}>
                          {row.untilResolved ? 'Until resolved' : row.endDate || 'Today'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ color: '#2563eb', fontWeight: 600 }}>{row.subjects}</td>
                      </>
                    )}
                    <td>
                      <span className="badge-import-valid">✓ Valid</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {parsedRows.length > 100 && (
            <p style={{ fontSize: '12px', color: '#8a94a6' }}>
              Showing first 100 of {parsedRows.length} rows. All will be imported.
            </p>
          )}

          <div className="excel-action-bar">
            <button
              type="button"
              className="excel-btn-secondary"
              onClick={() => setParsedRows([])}
            >
              Cancel Preview
            </button>
            <button
              type="button"
              className="excel-btn-primary"
              disabled={busy}
              onClick={handleConfirmImport}
            >
              {busy
                ? 'Importing…'
                : `Confirm & Import ${parsedRows.length} ${
                    category === 'exit'
                      ? 'Exit Restrictions'
                      : category === 'entry'
                      ? 'Entry Restrictions'
                      : 'Students'
                  } to Database`}
            </button>
          </div>
        </div>
      )}

      {/* IMPORT ERRORS IF ANY */}
      {importSummary?.errors && importSummary.errors.length > 0 && (
        <div style={{ marginTop: '10px', padding: '12px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '10px' }}>
          <strong style={{ color: '#991b1b', fontSize: '13px' }}>
            {importSummary.errors.length} row(s) could not be imported:
          </strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12.5px', color: '#7f1d1d' }}>
            {importSummary.errors.slice(0, 10).map((err, i) => (
              <li key={i}>
                Roll No <strong>{err.rollNo}</strong>: {err.error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
