import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { pictureFromFile } from '../lib/photo.js'
import '../pages/admin/admintracking.css'
import './archive.css'

// The Excel-fed rows for a day are snapshotted to Cloudinary automatically
// before they are deleted after 30 days. The Broadcast screen lists them in
// the same sheet layout the announcement tab uses: a date bar, the summary
// chips, the search field and the table.
//
// A class leader also proves those purged days for their own class by hand:
// the last column takes screenshots of the class record, several at a time.

const todayIso = () => new Date().toLocaleDateString('en-CA')

const MAX_SCREENSHOTS = 8

const when = (value) => {
  if (!value) return ''
  const text = String(value)
  const date = new Date(text.includes('T') ? text : `${text}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const classLabelFor = (uploader) =>
  `${uploader.grade === 'PU1' ? '11' : '12'}${uploader.section}`

export default function ArchiveGallery({ uploader = null }) {
  const [state, setState] = useState({ key: '', rows: [] })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [day, setDay] = useState('')
  const [text, setText] = useState('')
  const [version, setVersion] = useState(0)
  // The class leader's own screenshots for one archived day.
  const [draft, setDraft] = useState({ key: '', images: [] })
  const [saving, setSaving] = useState('')

  const key = `archives:${version}`
  const myLabel = uploader ? classLabelFor(uploader) : ''

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
  }, [key])

  const loading = state.key !== key

  const visible = useMemo(() => {
    const needle = text.trim().toLowerCase()
    return state.rows.filter((row) => {
      if (day && row.date !== day) return false
      if (!needle) return true
      return `${when(row.date)} ${row.date || ''}`.toLowerCase().includes(needle)
    })
  }, [state.rows, day, text])

  const latest = state.rows[0]?.date || ''
  const today = todayIso()

  const draftsFor = (row) => (draft.key === row.date ? draft.images : [])

  const choose = async (row, event) => {
    const files = [...(event.target.files || [])]
    event.target.value = ''
    if (files.length === 0) return
    if (files.some((file) => !/^image\/(jpeg|png|webp|gif)$/i.test(file.type))) {
      setError('Use JPG, PNG, WEBP or GIF images.')
      return
    }
    const current = draftsFor(row)
    try {
      const next = [...current]
      for (const file of files) {
        if (next.length >= MAX_SCREENSHOTS) break
        next.push(await pictureFromFile(file))
      }
      setDraft({ key: row.date, images: next })
      setNotice('')
      setError(
        current.length + files.length > MAX_SCREENSHOTS
          ? `Add up to ${MAX_SCREENSHOTS} screenshots at a time.`
          : ''
      )
    } catch (err) {
      setError(err.message)
    }
  }

  const save = async (row) => {
    const images = draftsFor(row)
    if (images.length === 0) {
      setError('Choose a screenshot first.')
      return
    }
    setSaving(row.date)
    setError('')
    setNotice('')
    try {
      await api.archivePhoto(row.date, { images })
      setDraft({ key: '', images: [] })
      setVersion((value) => value + 1)
      setNotice(
        `${images.length} screenshot${images.length === 1 ? '' : 's'} saved for ${myLabel} · ${when(row.date)}.`
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving('')
    }
  }

  return (
    <div className="trk-wrap">
      {error ? <div className="banner">{error}</div> : null}
      {notice ? (
        <p className="trk-upload-notice" role="status">
          {notice}
        </p>
      ) : null}

      <section className="trk-bar">
        <div className="trk-day">
          <label className="trk-date">
            <span>Broadcasts on</span>
            <input
              type="date"
              value={day}
              max={today}
              aria-label="Broadcast date"
              onChange={(event) => setDay(event.target.value)}
            />
          </label>
          {day ? (
            <button type="button" className="trk-filter" onClick={() => setDay('')}>
              All dates
            </button>
          ) : (
            <span className="trk-day-empty">Showing every archived day</span>
          )}
        </div>
      </section>

      {!loading ? (
        <div className="trk-summary">
          <span className="trk-chip is-viewed">
            {visible.length} of {state.rows.length} days shown
          </span>
          {latest ? <span className="trk-chip">Latest {when(latest)}</span> : null}
          {myLabel ? (
            <span className="trk-chip">
              {visible.filter((row) => row.photoUrls?.length).length} day(s) uploaded
            </span>
          ) : null}
        </div>
      ) : null}

      <section className="trk-tools">
        <input
          className="trk-search"
          type="search"
          value={text}
          placeholder="Search archived date"
          aria-label="Search archived date"
          onChange={(event) => setText(event.target.value)}
        />
      </section>

      <section className="trk-sheet" aria-live="polite">
        <table className="trk-table">
          <thead>
            <tr>
              <th className="trk-sno-head">Sl.no</th>
              <th>Date</th>
              <th>{myLabel ? 'Uploaded photo / Screenshot' : 'Uploaded photo'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="trk-empty">
                  Loading archive…
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={3} className="trk-empty">
                  {state.rows.length === 0
                    ? 'No broadcast snapshots yet. A day appears here once its Excel data is older than 30 days.'
                    : 'No archived broadcast matches this date or search.'}
                </td>
              </tr>
            ) : (
              visible.map((row, index) => {
                const drafts = draftsFor(row)
                return (
                  <tr key={row.id}>
                    <td className="trk-sno">{index + 1}</td>
                    <td>{when(row.date)}</td>
                    <td className="trk-photo">
                      {row.photoUrls?.length ? (
                        <>
                          <span className="trk-photo-links">
                            {row.photoUrls.map((url, photoIndex) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {row.photoUrls.length > 1
                                  ? `Open photo ${photoIndex + 1}`
                                  : 'Open photo'}
                              </a>
                            ))}
                          </span>
                          {row.photoAt ? (
                            <span>
                              Uploaded {row.photoAt} IST
                              {row.photoBy ? ` · by ${row.photoBy}` : ''}
                            </span>
                          ) : null}
                        </>
                      ) : row.url ? (
                        <a href={row.url} target="_blank" rel="noopener noreferrer">
                          Open photo
                        </a>
                      ) : myLabel ? (
                        <span>No photo</span>
                      ) : null}

                      {/* Without an uploader the snapshot links above are the
                          whole cell; the leader gets their own uploader. */}
                      {myLabel ? (
                        <div className="trk-own">
                          <div className="trk-own-actions">
                            <label className="trk-upload">
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                disabled={saving === row.date || drafts.length >= MAX_SCREENSHOTS}
                                onChange={(event) => choose(row, event)}
                              />
                              {row.photoUrls?.length ? 'Add screenshots' : 'Upload screenshots'}
                            </label>
                          </div>
                          {drafts.length ? (
                            <div className="trk-own-actions">
                              <span className="trk-own-ready">
                                {drafts.length} screenshot{drafts.length === 1 ? '' : 's'} ready
                              </span>
                              <button
                                type="button"
                                className="trk-own-save"
                                disabled={saving === row.date}
                                onClick={() => save(row)}
                              >
                                {saving === row.date ? 'Saving…' : 'Save screenshots'}
                              </button>
                              <button
                                type="button"
                                className="tap is-quiet"
                                disabled={saving === row.date}
                                onClick={() => setDraft({ key: row.date, images: [] })}
                              >
                                Clear
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
