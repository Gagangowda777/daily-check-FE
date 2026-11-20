import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

const classLabel = (student) => `${student.grade === 'PU1' ? '11' : '12'}${student.section}`

export default function StudentSearch() {
  const [text, setText] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const query = text.trim()
  const showPanel = open && query.length >= 2

  useEffect(() => {
    if (query.length < 2) return undefined

    let alive = true
    const timer = setTimeout(() => {
      api
        .search(query)
        .then((data) => {
          if (!alive) return
          setResults(data.students)
          setOpen(true)
          setError('')
        })
        .catch((err) => {
          if (alive) setError(err.message)
        })
    }, 250)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    if (!detail) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setDetail(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detail])

  const openStudent = (rollNo) => {
    setBusy(true)
    api
      .student(rollNo)
      .then((data) => {
        setDetail(data)
        setOpen(false)
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setBusy(false))
  }

  return (
    <div className="search-wrap">
      <input
        className="search-input"
        type="search"
        placeholder="Search roll no or name"
        aria-label="Search students"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onFocus={() => {
          if (results.length > 0) setOpen(true)
        }}
      />

      {showPanel && results.length > 0 ? (
        <div className="search-results">
          {results.map((student) => (
            <button
              key={student.rollNo}
              type="button"
              className="search-item"
              onClick={() => openStudent(student.rollNo)}
            >
              <span className="search-item-name">{student.name}</span>
              <span className="search-item-meta">
                {student.rollNo} · {classLabel(student)}
                {student.activeRestrictions.length > 0
                  ? ` · ${student.activeRestrictions.length} active`
                  : ''}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {showPanel && results.length === 0 ? (
        <div className="search-results">
          <p className="search-empty">No student matches “{query}”.</p>
        </div>
      ) : null}

      {error ? <p className="search-error">{error}</p> : null}
      {busy ? <span className="search-busy">Loading…</span> : null}

      {detail ? (
        <div className="modal-overlay" role="presentation" onClick={() => setDetail(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${detail.student.name} details`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3>{detail.student.name}</h3>
                <p className="modal-sub">
                  {detail.student.rollNo} · {classLabel(detail.student)}
                  {detail.student.busRoute ? ` · Bus ${detail.student.busRoute}` : ' · No bus'}
                </p>
              </div>
              <button type="button" className="modal-close" onClick={() => setDetail(null)}>
                Close
              </button>
            </div>

            <div className="modal-stats">
              <div className="modal-stat">
                <span className="modal-stat-value">{detail.activeRestrictions.length}</span>
                <span className="modal-stat-label">Active restrictions</span>
              </div>
              <div className="modal-stat">
                <span className="modal-stat-value">{detail.busLateHistory.length}</span>
                <span className="modal-stat-label">Recent bus lates</span>
              </div>
              <div className="modal-stat">
                <span className="modal-stat-value">{detail.repeatResolutions}</span>
                <span className="modal-stat-label">Repeat resolutions</span>
              </div>
            </div>

            <section className="modal-section">
              <h4>Active restrictions</h4>
              {detail.activeRestrictions.length === 0 ? (
                <p className="muted">None pending.</p>
              ) : (
                <ul className="modal-list">
                  {detail.activeRestrictions.map((item) => (
                    <li key={`${item.date}-${item.restrictionReason}`}>
                      <span className="badge pending">{item.restrictionType}</span>
                      <span>{item.restrictionReason}</span>
                      <span className="modal-date">{item.date}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="modal-section">
              <h4>Bus late history</h4>
              {detail.busLateHistory.length === 0 ? (
                <p className="muted">No late bus entries recorded.</p>
              ) : (
                <ul className="modal-list">
                  {detail.busLateHistory.map((item) => (
                    <li key={`${item.date}-bus`}>
                      <span>{item.date}</span>
                      <span className="modal-date">{item.busRoute || '-'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="modal-section">
              <h4>Last 7 days</h4>
              <ul className="modal-list">
                {detail.recent.map((item) => (
                  <li key={item.date}>
                    <span>{item.date}</span>
                    <span className={`badge ${item.attendance}`}>{item.attendance}</span>
                    <span className="modal-date">
                      {item.restrictionReason
                        ? `${item.restrictionReason} (${item.resolutionStatus})`
                        : '-'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  )
}
