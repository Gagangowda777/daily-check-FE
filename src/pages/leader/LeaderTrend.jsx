import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { ExcelSheet } from '../../components/ExcelSheet.jsx'

const prettyDate = (iso) => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
]

export default function LeaderTrend({ grade, section, version }) {
  const [days, setDays] = useState(7)
  const [state, setState] = useState({ key: '', rows: [] })
  const [error, setError] = useState('')

  const key = `${grade}:${section}:${days}:${version}`

  useEffect(() => {
    let alive = true
    api
      .leaderTrend({ grade, section, days })
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
  }, [grade, section, days, key])

  const rows = state.rows
  const loading = state.key !== key

  const toolbar = (
    <div className="xls-toolbar" role="group" aria-label="Trend range">
      {RANGES.map((range) => (
        <button
          key={range.days}
          type="button"
          className={`xls-pill${days === range.days ? ' is-active' : ''}`}
          onClick={() => setDays(range.days)}
        >
          {range.label}
        </button>
      ))}
    </div>
  )

  return (
    <>
      {error ? <div className="banner">{error}</div> : null}
      <ExcelSheet
        title="Attendance trend"
        meta={loading ? 'Loading…' : `Last ${days} days`}
        toolbar={toolbar}
        columns={['Sl. no.', 'Date', 'Present', 'Late', 'Absent', 'Late buses', 'Exits', 'NC']}
      >
        {loading ? (
          <tr>
            <td className="xls-empty" colSpan={8}>
              Loading the last {days} days…
            </td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <td className="xls-empty" colSpan={8}>
              No register data for this section yet.
            </td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr key={row.date} className="xls-row">
              <td className="xls-no">{index + 1}</td>
              <td className="xls-name">{prettyDate(row.date)}</td>
              <td>
                <strong>{row.present}</strong>
                <span className="xls-sub-text">of {row.roster}</span>
              </td>
              <td>{row.late}</td>
              <td>{row.absent}</td>
              <td>{row.busLate ? <span className="xls-badge is-late">{row.busLate}</span> : '0'}</td>
              <td>{row.exit || 0}</td>
              <td>{row.nc ?? '—'}</td>
            </tr>
          ))
        )}
      </ExcelSheet>
    </>
  )
}
