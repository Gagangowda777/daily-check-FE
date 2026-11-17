import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'

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
  const maxRoster = rows.reduce((max, row) => Math.max(max, row.roster), 0) || 1

  return (
    <section className="t-card">
      <div className="t-card-head">
        <h2>Attendance trend</h2>
        <div className="pills" role="group" aria-label="Trend range">
          {RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              className={`pill${days === range.days ? ' is-active' : ''}`}
              onClick={() => setDays(range.days)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      <div className="t-body">
        {error ? <div className="banner">{error}</div> : null}
        {loading ? <p className="muted">Loading the last {days} days…</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="muted">No register data for this section yet.</p>
        ) : null}

        {!loading && rows.length > 0 ? (
          <ul className="trend-list">
            {rows.map((row) => (
              <li key={row.date} className="trend-row">
                <span className="trend-date">{prettyDate(row.date)}</span>
                <span className="trend-bars">
                  <span
                    className="trend-bar is-present"
                    style={{ width: `${(row.present / maxRoster) * 100}%` }}
                    title={`${row.present} present`}
                  />
                  <span
                    className="trend-bar is-late"
                    style={{ width: `${(row.late / maxRoster) * 100}%` }}
                    title={`${row.late} late`}
                  />
                  <span
                    className="trend-bar is-absent"
                    style={{ width: `${(row.absent / maxRoster) * 100}%` }}
                    title={`${row.absent} absent`}
                  />
                </span>
                <span className="trend-numbers">
                  {row.present}/{row.roster}
                  {row.absent ? ` · ${row.absent} absent` : ''}
                </span>
                <span className="trend-extra">
                  {row.busLate ? `${row.busLate} late bus` : 'buses on time'} ·{' '}
                  {row.exit ? `${row.exit} exit` : 'no exit'} · NC {row.nc ?? '—'}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="trend-legend">
          <span>
            <i className="trend-swatch is-present" /> Present
          </span>
          <span>
            <i className="trend-swatch is-late" /> Late
          </span>
          <span>
            <i className="trend-swatch is-absent" /> Absent
          </span>
        </div>
      </div>
    </section>
  )
}
