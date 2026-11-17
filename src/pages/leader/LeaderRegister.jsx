import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'present', label: 'Present' },
  { id: 'late', label: 'Late' },
  { id: 'absent', label: 'Absent' },
]

const ATTENDANCE = [
  { id: 'present', label: 'P' },
  { id: 'late', label: 'L' },
  { id: 'absent', label: 'A' },
]

export default function LeaderRegister({ grade, section, version, onChanged }) {
  const [state, setState] = useState({ key: '', rows: [] })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const key = `${grade}:${section}:${version}`

  useEffect(() => {
    let alive = true
    api
      .leaderRegister({ grade, section })
      .then((payload) => {
        if (alive) {
          setState({ key, rows: payload.rows })
          setError('')
        }
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [grade, section, key])

  const rows = state.rows
  const text = query.trim().toLowerCase()
  const visible = rows.filter((row) => {
    if (filter !== 'all' && row.attendance !== filter) return false
    if (!text) return true
    return (
      row.rollNo.toLowerCase().includes(text) || row.name.toLowerCase().includes(text)
    )
  })

  const counts = rows.reduce(
    (total, row) => ({ ...total, [row.attendance]: total[row.attendance] + 1 }),
    { present: 0, late: 0, absent: 0 }
  )

  const mark = async (row, status) => {
    if (row.attendance === status) return
    setBusy(row.rollNo)
    setError('')
    setNotice('')
    try {
      await api.leaderAttendance(row.rollNo, { grade, section, status })
      setState((current) => ({
        ...current,
        rows: current.rows.map((item) =>
          item.rollNo === row.rollNo ? { ...item, attendance: status } : item
        ),
      }))
      setNotice(`${row.rollNo} ${row.name} marked ${status}.`)
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const loading = state.key !== key

  return (
    <section className="t-card">
      <div className="t-card-head">
        <h2>Class register</h2>
        <span className="t-count">
          {loading ? 'Loading…' : `${counts.present} present · ${counts.late} late · ${counts.absent} absent`}
        </span>
      </div>

      <div className="t-body">
        {error ? <div className="banner">{error}</div> : null}
        {notice ? (
          <p className="action-notice" role="status">
            {notice}
          </p>
        ) : null}

        <div className="register-tools">
          <input
            className="form-input"
            type="search"
            placeholder="Search roll number or name"
            aria-label="Search students"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="pills" role="group" aria-label="Attendance filter">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`pill${filter === item.id ? ' is-active' : ''}`}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <p className="t-row-sub">
          Attendance can be updated for today only, and only for your own section. Every change is
          logged.
        </p>

        {loading ? (
          <p className="muted">Loading the class register…</p>
        ) : visible.length === 0 ? (
          <p className="muted">No students match this search or filter.</p>
        ) : (
          <ul className="attendance-list">
            {visible.map((row) => (
              <li key={row.rollNo} className="attendance-row">
                <span className="attendance-no mono">{row.rollNo}</span>
                <span className="attendance-name">
                  {row.name}
                  <span className="t-row-sub">
                    {row.busRoute ? `Route ${row.busRoute}${row.busLate ? ' · late' : ''}` : 'No bus'}
                    {row.restrictionType ? ` · ${row.restrictionType} restriction` : ''}
                  </span>
                </span>
                <span className="attendance-actions" role="group" aria-label={`Attendance for ${row.name}`}>
                  {ATTENDANCE.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`attendance-tap att-${option.id}${
                        row.attendance === option.id ? ' is-on' : ''
                      }`}
                      disabled={busy === row.rollNo}
                      title={option.id}
                      onClick={() => mark(row, option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
