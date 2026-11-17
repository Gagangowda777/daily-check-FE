import { useState, useEffect } from 'react'
import { api } from '../../lib/api.js'
import '../../datasheet.css'

const CATEGORIES = [
  { id: 'exit_restriction', label: '🛑 Exit Restriction' },
  { id: 'entry_restriction', label: '⚠️ Entry NOC Pending' },
  { id: 'late_arrival', label: '⏰ Late Arrival' },
  { id: 'discipline', label: '📋 Disciplinary / Incident' },
  { id: 'parent_call', label: '📞 Parent Call / Notice' },
  { id: 'medical', label: '🩺 Medical / Leave' },
  { id: 'general', label: '📝 General Remark' },
]

const DEFAULT_EXIT_REASONS = [
  'Crossed 3 NCs',
  'Late to college',
  'Imposition pending',
  'L1',
  'L2',
  'Irregular',
  'Medical reason',
  'To be suspended',
]

const DEFAULT_ENTRY_SUBJECTS = [
  'BS, ECO, STATS',
  'ALL SUBJECTS',
  'ACC, ENG',
  'KAN, STATS, ECO',
  'BS, KAN',
]

export default function DataSheetView({ date, onChanged }) {
  const [mode, setMode] = useState('sheet') // 'sheet' | 'notes'
  const [version, setVersion] = useState(0)

  // Live Spreadsheet Grid state
  const [rows, setRows] = useState([
    { id: 1, rollNo: '', student: null, category: 'exit_restriction', detail: 'Crossed 3 NCs', untilResolved: true, endDate: '' },
    { id: 2, rollNo: '', student: null, category: 'exit_restriction', detail: 'Crossed 3 NCs', untilResolved: true, endDate: '' },
    { id: 3, rollNo: '', student: null, category: 'entry_restriction', detail: 'BS, ECO, STATS', untilResolved: true, endDate: '' },
    { id: 4, rollNo: '', student: null, category: 'late_arrival', detail: 'Late to college', untilResolved: true, endDate: '' },
    { id: 5, rollNo: '', student: null, category: 'discipline', detail: '', untilResolved: true, endDate: '' },
  ])

  // Notes state
  const [notesData, setNotesData] = useState({ notes: [], summary: {} })
  const [noteFilter, setNoteFilter] = useState('ALL')
  const [noteStatusFilter, setNoteStatusFilter] = useState('ALL')
  const [noteSearch, setNoteSearch] = useState('')
  const [quickNote, setQuickNote] = useState({
    rollNo: '',
    category: 'exit_restriction',
    content: '',
  })

  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  // Fetch notes
  useEffect(() => {
    let alive = true
    api
      .notes({ date })
      .then((res) => {
        if (!alive) return
        setNotesData(res)
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [date, version])

  // Auto-match student as user types roll number in spreadsheet rows
  const handleRollChange = async (index, rawRoll) => {
    const updated = [...rows]
    const norm = rawRoll.trim().toUpperCase()
    updated[index].rollNo = rawRoll

    setRows(updated)

    if (norm.length >= 4) {
      try {
        const res = await api.student(norm)
        if (res?.student) {
          updated[index].student = {
            name: res.student.name,
            classLabel: `${res.student.grade === 'PU1' ? '11' : '12'}${res.student.section}`,
          }
          setRows([...updated])
        }
      } catch {
        updated[index].student = null
        setRows([...updated])
      }
    } else {
      updated[index].student = null
      setRows([...updated])
    }
  }

  // Row operations
  const addRows = (count = 1) => {
    const newItems = Array.from({ length: count }, (_, i) => ({
      id: Date.now() + i,
      rollNo: '',
      student: null,
      category: 'exit_restriction',
      detail: 'Crossed 3 NCs',
      untilResolved: true,
      endDate: '',
    }))
    setRows([...rows, ...newItems])
  }

  const removeRow = (index) => {
    if (rows.length > 1) {
      setRows(rows.filter((_, i) => i !== index))
    }
  }

  const clearEmptyRows = () => {
    const filtered = rows.filter((r) => r.rollNo && r.rollNo.trim())
    setRows(filtered.length > 0 ? filtered : [
      { id: Date.now(), rollNo: '', student: null, category: 'exit_restriction', detail: 'Crossed 3 NCs', untilResolved: true, endDate: '' }
    ])
  }

  // Commit all rows from the digital spreadsheet
  const handleCommitSheet = async () => {
    const filled = rows.filter((r) => r.rollNo && r.rollNo.trim().length >= 3)
    if (filled.length === 0) {
      setError('Enter at least one student roll number in the sheet before committing.')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')

    try {
      const res = await api.commitDataSheet({
        date,
        rows: filled.map((r) => ({
          rollNo: r.rollNo.trim().toUpperCase(),
          category: r.category,
          detail: r.detail,
          untilResolved: r.untilResolved,
          endDate: r.endDate || null,
        })),
      })

      setNotice(`Successfully committed ${res.count} record(s) directly to the Daily Register for ${date}!`)
      setVersion((v) => v + 1)
      if (onChanged) onChanged()

      // Reset sheet with fresh empty rows
      setRows([
        { id: 1, rollNo: '', student: null, category: 'exit_restriction', detail: 'Crossed 3 NCs', untilResolved: true, endDate: '' },
        { id: 2, rollNo: '', student: null, category: 'exit_restriction', detail: 'Crossed 3 NCs', untilResolved: true, endDate: '' },
        { id: 3, rollNo: '', student: null, category: 'entry_restriction', detail: 'BS, ECO, STATS', untilResolved: true, endDate: '' },
      ])
    } catch (err) {
      setError(err.message || 'Failed to commit sheet data.')
    } finally {
      setBusy(false)
    }
  }

  // Handle Quick Note submission
  const handleCreateQuickNote = async (e) => {
    e.preventDefault()
    if (!quickNote.content.trim()) return

    setBusy(true)
    setError('')
    try {
      await api.addNote({
        date,
        rollNo: quickNote.rollNo.trim().toUpperCase() || null,
        category: quickNote.category,
        content: quickNote.content.trim(),
      })
      setNotice('Note recorded in daily logbook!')
      setQuickNote({ rollNo: '', category: 'exit_restriction', content: '' })
      setVersion((v) => v + 1)
      if (onChanged) onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Apply note as exit restriction or entry restriction
  const handleApplyNote = async (note, applyType) => {
    setBusy(true)
    setError('')
    try {
      await api.applyNote(note._id, {
        applyType,
        reason: note.content,
        subjects: [note.content],
        untilResolved: true,
      })
      setNotice(
        `Note for ${note.rollNo} applied as ${
          applyType === 'exit' ? 'Exit Restriction' : 'Entry Restriction'
        }!`
      )
      setVersion((v) => v + 1)
      if (onChanged) onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteNote = async (id) => {
    if (!window.confirm('Delete this note?')) return
    try {
      await api.deleteNote(id)
      setVersion((v) => v + 1)
    } catch (err) {
      setError(err.message)
    }
  }

  // Filter notes
  const query = noteSearch.trim().toLowerCase()
  const filteredNotes = (notesData.notes || []).filter((n) => {
    if (noteFilter !== 'ALL' && n.category !== noteFilter) return false
    if (noteStatusFilter !== 'ALL' && n.status !== noteStatusFilter) return false
    if (!query) return true
    return (
      (n.rollNo && n.rollNo.toLowerCase().includes(query)) ||
      (n.name && n.name.toLowerCase().includes(query)) ||
      (n.content && n.content.toLowerCase().includes(query))
    )
  })

  return (
    <div className="datasheet-container">
      {/* Head navigation & stats */}
      <div className="datasheet-head-card">
        <div className="datasheet-nav-row">
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0b1220', margin: 0 }}>
              In-App Data Sheet & Digital Notes
            </h2>
            <p style={{ fontSize: '13px', color: '#475467', margin: '4px 0 0' }}>
              Note down restrictions, late arrivals, and incident records directly in the web app without needing Excel.
            </p>
          </div>

          <div className="datasheet-mode-tabs">
            <button
              type="button"
              className={`datasheet-mode-btn ${mode === 'sheet' ? 'is-active' : ''}`}
              onClick={() => setMode('sheet')}
            >
              📊 Live Spreadsheet Grid
            </button>
            <button
              type="button"
              className={`datasheet-mode-btn ${mode === 'notes' ? 'is-active' : ''}`}
              onClick={() => setMode('notes')}
            >
              📋 Incident & Daily Logbook
              {notesData?.summary?.active ? (
                <span className="gate-tab-count">{notesData.summary.active}</span>
              ) : null}
            </button>
          </div>
        </div>

        {/* Mini stats */}
        <div className="datasheet-stats">
          <div className="datasheet-stat">
            <span>Total Notes Today</span>
            <strong>{notesData.summary.total || 0}</strong>
          </div>
          <div className="datasheet-stat" style={{ borderLeft: '3px solid #dc2626' }}>
            <span>Exit Flags Noted</span>
            <strong style={{ color: '#dc2626' }}>
              {notesData.summary.exitRestrictions || 0}
            </strong>
          </div>
          <div className="datasheet-stat" style={{ borderLeft: '3px solid #2563eb' }}>
            <span>Entry NOCs Noted</span>
            <strong style={{ color: '#2563eb' }}>
              {notesData.summary.entryRestrictions || 0}
            </strong>
          </div>
          <div className="datasheet-stat" style={{ borderLeft: '3px solid #15803d' }}>
            <span>Applied to Register</span>
            <strong style={{ color: '#15803d' }}>
              {notesData.summary.applied || 0}
            </strong>
          </div>
        </div>
      </div>

      {/* Notices */}
      {notice && <div className="notice-banner">{notice}</div>}
      {error && <div className="error-banner">{error}</div>}

      {/* MODE 1: LIVE SPREADSHEET GRID */}
      {mode === 'sheet' && (
        <div className="sheet-grid-card">
          <div className="sheet-grid-toolbar">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="excel-btn-secondary"
                onClick={() => addRows(1)}
              >
                + Add Row
              </button>
              <button
                type="button"
                className="excel-btn-secondary"
                onClick={() => addRows(5)}
              >
                + Add 5 Rows
              </button>
              <button
                type="button"
                className="excel-btn-secondary"
                onClick={() => addRows(10)}
              >
                + Add 10 Rows
              </button>
              <button
                type="button"
                className="btn-action-secondary"
                onClick={clearEmptyRows}
                title="Remove blank rows"
              >
                Clear Empty
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>
                {rows.filter((r) => r.rollNo).length} of {rows.length} rows filled
              </span>
              <button
                type="button"
                className="excel-btn-primary"
                style={{ background: '#15803d' }}
                disabled={busy}
                onClick={handleCommitSheet}
              >
                {busy ? 'Committing…' : `💾 Commit & Apply to Register (${date})`}
              </button>
            </div>
          </div>

          <div className="sheet-table-scroll">
            <table className="sheet-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th style={{ width: '130px' }}>Roll Number *</th>
                  <th style={{ width: '170px' }}>Student Info</th>
                  <th style={{ width: '190px' }}>Data Category *</th>
                  <th>Reason / Pending Subjects / Remarks</th>
                  <th style={{ width: '140px' }}>Duration / Rules</th>
                  <th style={{ width: '40px' }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id}>
                    <td style={{ color: '#8a94a6', textAlign: 'center', fontWeight: 700 }}>
                      {idx + 1}
                    </td>
                    <td>
                      <input
                        type="text"
                        className="sheet-input"
                        placeholder="e.g. 25A201"
                        value={row.rollNo}
                        onChange={(e) => handleRollChange(idx, e.target.value)}
                      />
                    </td>
                    <td>
                      {row.student ? (
                        <span className="student-tag-match">
                          ✓ {row.student.name} ({row.student.classLabel})
                        </span>
                      ) : row.rollNo && row.rollNo.length >= 4 ? (
                        <span className="student-tag-missing">⚠ Check roll</span>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: '11px' }}>—</span>
                      )}
                    </td>
                    <td>
                      <select
                        className="sheet-select"
                        value={row.category}
                        onChange={(e) => {
                          const next = [...rows]
                          next[idx].category = e.target.value
                          if (e.target.value === 'exit_restriction') next[idx].detail = 'Crossed 3 NCs'
                          else if (e.target.value === 'entry_restriction') next[idx].detail = 'BS, ECO, STATS'
                          else if (e.target.value === 'late_arrival') next[idx].detail = 'Late to college'
                          setRows(next)
                        }}
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="sheet-input"
                        list={`suggestions-${idx}`}
                        placeholder="Type or select reason/notes..."
                        value={row.detail}
                        onChange={(e) => {
                          const next = [...rows]
                          next[idx].detail = e.target.value
                          setRows(next)
                        }}
                      />
                      <datalist id={`suggestions-${idx}`}>
                        {row.category === 'exit_restriction' &&
                          DEFAULT_EXIT_REASONS.map((r) => <option key={r} value={r} />)}
                        {row.category === 'entry_restriction' &&
                          DEFAULT_ENTRY_SUBJECTS.map((s) => <option key={s} value={s} />)}
                      </datalist>
                    </td>
                    <td>
                      {row.category === 'exit_restriction' ? (
                        <select
                          className="sheet-select"
                          value={row.untilResolved ? 'resolved' : 'today'}
                          onChange={(e) => {
                            const next = [...rows]
                            next[idx].untilResolved = e.target.value === 'resolved'
                            setRows(next)
                          }}
                        >
                          <option value="resolved">Until resolved</option>
                          <option value="today">Today only</option>
                        </select>
                      ) : (
                        <span style={{ fontSize: '11.5px', color: '#64748b' }}>Standard</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 800 }}
                        title="Delete row"
                        onClick={() => removeRow(idx)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODE 2: INCIDENT & DAILY LOGBOOK */}
      {mode === 'notes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Quick Note Entry Form */}
          <form onSubmit={handleCreateQuickNote} className="quick-note-box">
            <span className="quick-note-title">+ Note Down Daily Observation / Incident</span>
            <div className="quick-note-grid">
              <input
                type="text"
                className="gate-filter-input"
                placeholder="Roll No (optional)"
                value={quickNote.rollNo}
                onChange={(e) => setQuickNote({ ...quickNote, rollNo: e.target.value })}
              />

              <select
                className="gate-filter-select"
                value={quickNote.category}
                onChange={(e) => setQuickNote({ ...quickNote, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>

              <input
                type="text"
                className="gate-filter-input"
                placeholder="Write observation, violation, or follow-up note..."
                required
                value={quickNote.content}
                onChange={(e) => setQuickNote({ ...quickNote, content: e.target.value })}
              />

              <button type="submit" className="excel-btn-primary" disabled={busy || !quickNote.content.trim()}>
                + Save Note
              </button>
            </div>
          </form>

          {/* Notes Filters */}
          <div className="gate-table-card">
            <div className="gate-filter-row">
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`gate-tab ${noteFilter === 'ALL' ? 'is-active' : ''}`}
                  onClick={() => setNoteFilter('ALL')}
                >
                  All ({notesData.notes?.length || 0})
                </button>
                <button
                  type="button"
                  className={`gate-tab ${noteFilter === 'exit_restriction' ? 'is-active' : ''}`}
                  onClick={() => setNoteFilter('exit_restriction')}
                >
                  Exit Flags
                </button>
                <button
                  type="button"
                  className={`gate-tab ${noteFilter === 'entry_restriction' ? 'is-active' : ''}`}
                  onClick={() => setNoteFilter('entry_restriction')}
                >
                  Entry NOCs
                </button>
                <button
                  type="button"
                  className={`gate-tab ${noteFilter === 'discipline' ? 'is-active' : ''}`}
                  onClick={() => setNoteFilter('discipline')}
                >
                  Incidents
                </button>
              </div>

              <input
                type="search"
                className="gate-filter-input"
                placeholder="Search notes by roll, name, content..."
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
              />
            </div>

            {/* Notes List */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredNotes.length === 0 ? (
                <p className="empty-state">No notes recorded matching the filter for {date}.</p>
              ) : (
                filteredNotes.map((note) => (
                  <div
                    key={note._id}
                    className={`note-card-item ${note.status === 'applied' ? 'is-applied' : ''}`}
                  >
                    <div className="note-card-head">
                      <div className="note-card-student">
                        {note.rollNo ? (
                          <>
                            <strong>{note.rollNo}</strong>
                            {note.name && <span>{note.name}</span>}
                            {note.section && (
                              <span className="badge-status is-blue">
                                {note.grade === 'PU1' ? '11' : '12'}
                                {note.section}
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: '#475467' }}>General Campus Note</span>
                        )}
                        <span className="badge-status is-amber">{note.category}</span>
                      </div>
                      <span className="note-card-time">{note.time}</span>
                    </div>

                    <div className="note-card-body">{note.content}</div>

                    <div className="note-card-actions">
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {note.status === 'applied' ? (
                          <span className="badge-status is-green">✓ Applied to Register</span>
                        ) : (
                          <span className="badge-status is-gray">Active Draft</span>
                        )}
                        <span style={{ fontSize: '11.5px', color: '#8a94a6' }}>
                          By {note.author}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        {note.status !== 'applied' && note.rollNo && (
                          <>
                            <button
                              type="button"
                              className="btn-mini-log"
                              style={{ background: '#b91c1c' }}
                              disabled={busy}
                              onClick={() => handleApplyNote(note, 'exit')}
                              title="Turn this note into an Exit Restriction"
                            >
                              ⚡ Apply as Exit Restriction
                            </button>
                            <button
                              type="button"
                              className="btn-mini-log"
                              style={{ background: '#2563eb' }}
                              disabled={busy}
                              onClick={() => handleApplyNote(note, 'entry')}
                              title="Turn this note into an Entry Restriction"
                            >
                              ⚡ Apply as Entry NOC
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn-action-secondary"
                          style={{ padding: '4px 8px', fontSize: '12px', color: '#dc2626' }}
                          onClick={() => handleDeleteNote(note._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
