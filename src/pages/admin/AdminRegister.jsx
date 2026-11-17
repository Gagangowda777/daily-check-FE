import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'

const PAGE_SIZE = 120

const classLabel = (row) => `${row.grade === 'PU1' ? '11' : '12'}${row.section}`

// The full day's register. A day is ~1,700 rows, so it pages in the browser.
export default function AdminRegister({ date, grade, section, reload }) {
  const [state, setState] = useState({ key: '', rows: [] })
  const [error, setError] = useState('')
  const [page, setPage] = useState({ key: '', count: PAGE_SIZE })

  const key = `${date}|${grade}|${section}|${reload}`
  const loading = state.key !== key
  const rows = state.rows
  const shownCount = page.key === key ? page.count : PAGE_SIZE
  const visibleRows = rows.slice(0, shownCount)

  useEffect(() => {
    let alive = true
    api
      .records({ date, grade, section })
      .then((payload) => {
        if (alive) setState({ key, rows: payload.rows })
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [date, grade, section, key])

  return (
    <div className="content">
      {error ? <div className="banner">{error}</div> : null}

      <section className="table-card">
        <div className="table-head">
          <h2>Daily register</h2>
          <span className="muted">
            {loading
              ? 'Loading…'
              : visibleRows.length < rows.length
                ? `${visibleRows.length} of ${rows.length} rows`
                : `${rows.length} rows`}
          </span>
        </div>

        {!loading && rows.length === 0 ? (
          <p className="empty">No records for this date. Pick another date from the calendar.</p>
        ) : (
          <div className="table-wrap">
            <table className="records">
              <thead>
                <tr>
                  <th>Roll no</th>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Attendance</th>
                  <th>Bus</th>
                  <th>Restriction</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.rollNo}>
                    <td className="mono">{row.rollNo}</td>
                    <td className="student-name">{row.name}</td>
                    <td>{classLabel(row)}</td>
                    <td>
                      <span className={`badge ${row.attendance}`}>{row.attendance}</span>
                    </td>
                    <td>
                      {row.busRoute ? (
                        <span className={row.busLate ? 'bus-late' : undefined}>
                          {row.busRoute}
                          {row.busLate ? ' · late' : ''}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {row.restrictionReason ? (
                        <span>
                          <span className="restriction-type">
                            {row.restrictionType === 'exit' ? 'Exit' : 'Entry'}
                          </span>{' '}
                          {row.restrictionReason}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${row.resolutionStatus}`}>
                        {row.resolutionStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && visibleRows.length < rows.length ? (
          <div className="more-row">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setPage({ key, count: shownCount + PAGE_SIZE })}
            >
              Show {Math.min(PAGE_SIZE, rows.length - visibleRows.length)} more
            </button>
            <span className="muted">{rows.length - visibleRows.length} remaining</span>
          </div>
        ) : null}
      </section>
    </div>
  )
}
