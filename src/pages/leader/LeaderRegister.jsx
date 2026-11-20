import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { ExcelSheet } from '../../components/ExcelSheet.jsx'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'present', label: 'Present' },
  { id: 'late', label: 'Late' },
  { id: 'absent', label: 'Absent' },
]

const ATTENDANCE_LABEL = {
  present: { label: 'Present', tone: 'is-ok' },
  late: { label: 'Late', tone: 'is-late' },
  absent: { label: 'Absent', tone: 'is-alert' },
}

export default function LeaderRegister({ grade, section, version }) {
  const [state, setState] = useState({ key: '', rows: [] })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')

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
    return row.rollNo.toLowerCase().includes(text) || row.name.toLowerCase().includes(text)
  })

  const counts = rows.reduce(
    (total, row) => ({ ...total, [row.attendance]: total[row.attendance] + 1 }),
    { present: 0, late: 0, absent: 0 }
  )

  const loading = state.key !== key

  const toolbar = (
    <div className="xls-toolbar">
      <input
        className="form-input"
        type="search"
        placeholder="Search roll or name"
        aria-label="Search students"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {FILTERS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`xls-pill${filter === item.id ? ' is-active' : ''}`}
          onClick={() => setFilter(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )

  return (
    <>
      {error ? <div className="banner">{error}</div> : null}
      <ExcelSheet
        title="Class register"
        meta={
          loading
            ? 'Loading…'
            : `${counts.present} present · ${counts.late} late · ${counts.absent} absent`
        }
        note="Read only. The class teacher marks attendance for this section."
        toolbar={toolbar}
        columns={['Sl. no.', 'Roll no', 'Student', 'Bus', 'Attendance']}
      >
        {loading ? (
          <tr>
            <td className="xls-empty" colSpan={5}>
              Loading the class register…
            </td>
          </tr>
        ) : visible.length === 0 ? (
          <tr>
            <td className="xls-empty" colSpan={5}>
              No students match this search or filter.
            </td>
          </tr>
        ) : (
          visible.map((row, index) => (
            <tr key={row.rollNo} className="xls-row">
              <td className="xls-no">{index + 1}</td>
              <td className="xls-time">{row.rollNo}</td>
              <td>
                <span className="xls-name">{row.name}</span>
                {row.restrictionType ? (
                  <span className="xls-sub-text">{row.restrictionType} restriction</span>
                ) : null}
              </td>
              <td>
                {row.busRoute ? `${row.busRoute}${row.busLate ? ' · late' : ''}` : 'No bus'}
              </td>
              <td>
                <span
                  className={`xls-badge ${ATTENDANCE_LABEL[row.attendance]?.tone || 'is-pending'}`}
                >
                  {ATTENDANCE_LABEL[row.attendance]?.label || row.attendance}
                </span>
              </td>
            </tr>
          ))
        )}
      </ExcelSheet>
    </>
  )
}
