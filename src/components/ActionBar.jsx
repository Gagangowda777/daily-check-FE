import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import ExcelFeedPanel from './ExcelFeedPanel.jsx'

const ALL_SUBJECTS = 'All Subjects'

// Admin-editable lists come from /settings; these are only the fallback if
// that request fails.
const FALLBACK_EXIT_REASONS = [
  'Crossed 3 NCs',
  'Late to college',
  'Imposition pending',
  'L1',
  'L2',
  'Irregular',
  'Medical reason',
  'To be suspended',
]

const FALLBACK_SUBJECTS = [
  'BS',
  'ECO',
  'ENG',
  'KAN',
  'STATS',
  'ACC',
  'HIN',
  ALL_SUBJECTS,
]

const MESSAGE_TYPES = [
  { id: 'update', label: 'Update' },
  { id: 'announcement', label: 'Announcement' },
  { id: 'authorized-exit', label: 'Authorized Exit' },
  { id: 'broadcast', label: 'Broadcast' },
]

const classLabel = (student) => `${student.grade === 'PU1' ? '11' : '12'}${student.section}`

export default function ActionBar({ date, onCreated }) {
  const [open, setOpen] = useState(null)
  const [notice, setNotice] = useState('')
  const [lists, setLists] = useState({
    exitReasons: FALLBACK_EXIT_REASONS,
    entrySubjects: FALLBACK_SUBJECTS,
  })

  // Keep the quick-action forms in step with Settings instead of hardcoding
  // a second copy of the lists.
  useEffect(() => {
    let alive = true
    api
      .settings()
      .then((config) => {
        if (!alive) return
        setLists({
          exitReasons: config.exitReasons?.length ? config.exitReasons : FALLBACK_EXIT_REASONS,
          entrySubjects: config.entrySubjects?.length
            ? config.entrySubjects
            : FALLBACK_SUBJECTS,
        })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const start = (action) => {
    setNotice('')
    setOpen(action)
  }

  const finish = (message) => {
    setOpen(null)
    setNotice(message)
    onCreated()
  }

  return (
    <>
      <div className="quick-actions">
        <button type="button" className="action-button" onClick={() => start('exit')}>
          + Add exit restriction
        </button>
        <button type="button" className="action-button" onClick={() => start('entry')}>
          + Add entry restriction
        </button>
        <button type="button" className="action-button is-secondary" onClick={() => start('message')}>
          + Send message
        </button>
        <button type="button" className="action-button is-secondary" style={{ background: '#0b1220', color: '#ffffff' }} onClick={() => start('excel')}>
          📊 Feed from Excel / Bulk
        </button>
      </div>

      {notice ? (
        <p className="action-notice" role="status">
          {notice}
        </p>
      ) : null}

      {open === 'exit' ? (
        <ExitForm
          date={date}
          reasons={lists.exitReasons}
          onDone={finish}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === 'entry' ? (
        <EntryForm
          date={date}
          subjects={lists.entrySubjects}
          onDone={finish}
          onClose={() => setOpen(null)}
        />
      ) : null}
      {open === 'message' ? (
        <MessageForm date={date} onDone={finish} onClose={() => setOpen(null)} />
      ) : null}
      {open === 'excel' ? (
        <Drawer
          title="Feed Data from Excel"
          subtitle={`Import spreadsheet records or paste data directly for ${date}`}
          onClose={() => setOpen(null)}
        >
          <ExcelFeedPanel
            date={date}
            onChanged={() => finish('Excel data import complete.')}
            onClose={() => setOpen(null)}
          />
        </Drawer>
      ) : null}
    </>
  )
}

function Drawer({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            <p className="modal-sub">{subtitle}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Students can only be chosen from the master list — the box is a search field,
// never free text.
function StudentPicker({ value, onPick }) {
  const [text, setText] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)

  const search = text.trim()

  useEffect(() => {
    if (search.length < 2) return undefined

    let alive = true
    const timer = setTimeout(() => {
      setBusy(true)
      api
        .search(search)
        .then((data) => {
          if (alive) setResults(data.students)
        })
        .catch(() => {
          if (alive) setResults([])
        })
        .finally(() => {
          if (alive) setBusy(false)
        })
    }, 220)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [search])

  if (value) {
    return (
      <div className="picked-student">
        <div>
          <strong>{value.name}</strong>
          <span className="picked-meta">
            {value.rollNo} · {classLabel(value)}
          </span>
        </div>
        <button type="button" className="ghost-button" onClick={() => onPick(null)}>
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="picker">
      <input
        className="form-input"
        placeholder="Search roll number or name"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {search.length >= 2 ? (
        <ul className="picker-list">
          {results.map((student) => (
            <li key={student.rollNo}>
              <button type="button" className="picker-item" onClick={() => onPick(student)}>
                <strong>{student.name}</strong>
                <span className="picked-meta">
                  {student.rollNo} · {classLabel(student)}
                </span>
              </button>
            </li>
          ))}
          {!busy && results.length === 0 ? (
            <li className="picker-empty">No match in the master list.</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}

function ExitForm({ date, reasons, onDone, onClose }) {
  const [student, setStudent] = useState(null)
  const [reason, setReason] = useState(reasons[0] || '')
  const [untilResolved, setUntilResolved] = useState(false)
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // The list can arrive just after the drawer mounts, so fall back to the
  // first available reason without an extra render-syncing effect.
  const activeReason = reasons.includes(reason) ? reason : reasons[0] || ''

  const submit = async (event) => {
    event.preventDefault()

    if (!student) {
      setError('Pick a student from the master list.')
      return
    }
    if (!untilResolved && !endDate) {
      setError('Set an end date or choose Until Resolved.')
      return
    }

    setBusy(true)
    setError('')
    try {
      await api.addExitRestriction({
        rollNo: student.rollNo,
        reason: activeReason,
        endDate: untilResolved ? null : endDate,
        untilResolved,
        date,
      })
      onDone(`Exit restriction added for ${student.name}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      title="Add exit restriction"
      subtitle={`Effective ${date} · blocks gate exit until resolved`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <label htmlFor="exit-student">Student</label>
          <StudentPicker value={student} onPick={setStudent} />
        </div>

        <div className="form-row">
          <label htmlFor="exit-reason">Reason</label>
          <select
            id="exit-reason"
            className="form-input"
            value={activeReason}
            onChange={(event) => setReason(event.target.value)}
          >
            {reasons.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="exit-end">End date</label>
          <input
            id="exit-end"
            className="form-input"
            type="date"
            value={endDate}
            min={date}
            disabled={untilResolved}
            onChange={(event) => setEndDate(event.target.value)}
          />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={untilResolved}
              onChange={(event) => setUntilResolved(event.target.checked)}
            />
            Until resolved
          </label>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="submit-row">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="action-button" disabled={busy}>
            {busy ? 'Saving…' : 'Add restriction'}
          </button>
        </div>
      </form>
    </Drawer>
  )
}

function EntryForm({ date, subjects: availableSubjects, onDone, onClose }) {
  const [student, setStudent] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const toggle = (subject) => {
    setError('')
    if (subject === ALL_SUBJECTS) {
      setSubjects((current) => (current.includes(ALL_SUBJECTS) ? [] : [ALL_SUBJECTS]))
      return
    }
    setSubjects((current) => {
      const withoutAll = current.filter((item) => item !== ALL_SUBJECTS)
      return withoutAll.includes(subject)
        ? withoutAll.filter((item) => item !== subject)
        : [...withoutAll, subject]
    })
  }

  const submit = async (event) => {
    event.preventDefault()

    if (!student) {
      setError('Pick a student from the master list.')
      return
    }
    if (subjects.length === 0) {
      setError('Select at least one pending subject.')
      return
    }

    setBusy(true)
    setError('')
    try {
      await api.addEntryRestriction({ rollNo: student.rollNo, subjects, date })
      onDone(`Entry restriction added for ${student.name}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      title="Add entry restriction"
      subtitle={`Effective ${date} · blocks entry until the NOC is cleared`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-row">
          <label htmlFor="entry-student">Student</label>
          <StudentPicker value={student} onPick={setStudent} />
        </div>

        <div className="form-row">
          <span className="form-label">Pending subjects</span>
          <div className="chip-row">
            {availableSubjects.map((subject) => (
              <button
                key={subject}
                type="button"
                className={`chip${subjects.includes(subject) ? ' is-on' : ''}`}
                aria-pressed={subjects.includes(subject)}
                onClick={() => toggle(subject)}
              >
                {subject}
              </button>
            ))}
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        <div className="submit-row">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="action-button" disabled={busy}>
            {busy ? 'Saving…' : 'Add restriction'}
          </button>
        </div>
      </form>
    </Drawer>
  )
}

function MessageForm({ date, onDone, onClose }) {
  const [type, setType] = useState('update')
  const [scope, setScope] = useState('ALL')
  const [sections, setSections] = useState([])
  const [grades, setGrades] = useState({ PU1: [], PU2: [] })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .filters()
      .then((data) => setGrades(data.grades))
      .catch(() => setGrades({ PU1: [], PU2: [] }))
  }, [])

  // Keys are "grade:section" because letters repeat (11A and 12A).
  const toggleSection = (grade, section) => {
    setError('')
    const key = `${grade}:${section}`
    setSections((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    )
  }

  const submit = async (event) => {
    event.preventDefault()

    if (scope === 'SECTIONS' && sections.length === 0) {
      setError('Pick at least one section.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const targets = sections.map((key) => {
        const [grade, section] = key.split(':')
        return { grade, section }
      })
      const result = await api.sendMessage({ type, scope, sections: targets, date })
      onDone(`${result.sent} message(s) sent — ${result.target}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer title="Send message" subtitle={`Broadcast for ${date}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-row">
          <label htmlFor="message-type">Type</label>
          <select
            id="message-type"
            className="form-input"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            {MESSAGE_TYPES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <span className="form-label">Target</span>
          <div className="chip-row">
            {[
              { id: 'ALL', label: 'Whole school' },
              { id: 'PU1', label: 'PU1' },
              { id: 'PU2', label: 'PU2' },
              { id: 'SECTIONS', label: 'Specific sections' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                className={`chip${scope === item.id ? ' is-on' : ''}`}
                aria-pressed={scope === item.id}
                onClick={() => {
                  setScope(item.id)
                  setError('')
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {scope === 'SECTIONS' ? (
          <div className="form-row">
            <span className="form-label">Sections</span>
            {['PU1', 'PU2'].map((grade) => (
              <div key={grade} className="section-group">
                <span className="section-group-label">{grade}</span>
                <div className="chip-row">
                  {(grades[grade] || []).map((item) => {
                    const key = `${grade}:${item.section}`
                    return (
                    <button
                      key={`${grade}-${item.section}`}
                      type="button"
                      className={`chip${sections.includes(key) ? ' is-on' : ''}`}
                      aria-pressed={sections.includes(key)}
                      onClick={() => toggleSection(grade, item.section)}
                    >
                      {grade === 'PU1' ? '11' : '12'}
                      {item.section}
                    </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}

        <div className="submit-row">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="action-button" disabled={busy}>
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </Drawer>
  )
}
