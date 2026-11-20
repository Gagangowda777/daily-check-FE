import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import './archive.css'

// The Excel-fed rows for a day are snapshotted to Cloudinary before they are
// deleted after 30 days. The Broadcast screen lists those snapshots.

const when = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ArchiveGallery() {
  const [state, setState] = useState({ key: '', rows: [] })
  const [error, setError] = useState('')

  const key = 'archives'

  useEffect(() => {
    let alive = true
    api
      .archives()
      .then((payload) => {
        if (!alive) return
        setState({ key, rows: payload.archives || [] })
        setError('')
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [])

  const loading = state.key !== key

  return (
    <section className="ar-board">
      <div className="ar-head">
        <h2>Excel data archive</h2>
        <p>
          Screenshots of each day's Excel data, taken and uploaded to Cloudinary before the rows are
          deleted after 30 days.
        </p>
      </div>

      {error ? <div className="banner">{error}</div> : null}

      {loading ? (
        <p className="empty">Loading archive…</p>
      ) : state.rows.length === 0 ? (
        <p className="empty">
          No archived days yet. A day appears here once its Excel data is older than 30 days.
        </p>
      ) : (
        <ul className="ar-grid">
          {state.rows.map((row) => (
            <li key={row.id}>
              <a className="ar-card" href={row.url} target="_blank" rel="noreferrer">
                <img src={row.url} alt={`Snapshot of the Excel data for ${row.date}`} loading="lazy" />
                <span className="ar-body">
                  <strong>{row.date}</strong>
                  <span className="ar-meta">
                    {row.rows} row{row.rows === 1 ? '' : 's'} archived
                    {row.deletedAt ? ` · removed ${when(row.deletedAt)}` : ''}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
