import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api.js'
import { PhotoComposer } from '../../components/AnnouncementBoard.jsx'
import CameraShot from '../../components/CameraShot.jsx'
import './admintracking.css'

// Read tracking for the admin desk. One sheet lists every class for the
// chosen broadcast or announcement: whether it was opened, the date and time,
// and the photo that class uploaded as proof.

const FILTERS = [
  { id: 'all', label: 'All classes' },
  { id: 'viewed', label: 'Viewed' },
  { id: 'pending', label: 'Not viewed' },
]

const todayIso = () => new Date().toLocaleDateString('en-CA')

const formatDay = (iso) => {
  if (!iso) return ''
  const when = new Date(`${iso}T00:00:00`)
  return Number.isNaN(when.getTime())
    ? iso
    : when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const statusLabel = { viewed: 'Viewed', pending: 'Not viewed', 'not-sent': 'Not sent' }

const classLabelFor = (uploader) =>
  `${uploader.grade === 'PU1' ? '11' : '12'}${uploader.section}`

export default function AdminTracking({
  fixedKind = '',
  showTypeTabs = true,
  announcementUploader = null,
  canPostAnnouncement = false,
}) {
  const [sources, setSources] = useState({ key: '', broadcasts: [], announcements: [] })
  const [innerKind, setInnerKind] = useState('broadcast')
  const kind = fixedKind || innerKind
  // True when a class leader is reading the sheet; the uploader object itself
  // is rebuilt on every render, so only this flag is tracked.
  const leaderView = Boolean(announcementUploader)
  const [pickedId, setPickedId] = useState('')
  // Announcements are shown one day at a time, starting from today; the date
  // field is how an older day is reached.
  const [announcementDate, setAnnouncementDate] = useState('')
  const [table, setTable] = useState({ key: '', data: null })
  const [filter, setFilter] = useState('all')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [uploadNotice, setUploadNotice] = useState('')
  const [uploadVersion, setUploadVersion] = useState(0)
  const [sourcesVersion, setSourcesVersion] = useState(0)
  const [compose, setCompose] = useState(false)
  // The class leader's own photo for the picked announcement.
  const [ownDraft, setOwnDraft] = useState({ key: '', images: [] })
  const [camera, setCamera] = useState(false)
  const [savingPhoto, setSavingPhoto] = useState(false)

  useEffect(() => {
    let alive = true
    // A fixed tab only needs its own source. The admin desk keeps both lists
    // available while its internal type tabs switch.
    const needBroadcasts = fixedKind !== 'announcement'
    const needAnnouncements = fixedKind !== 'broadcast'
    Promise.all([
      needBroadcasts ? api.sentMessages({ limit: 40 }) : Promise.resolve({ messages: [] }),
      needAnnouncements ? api.announcements() : Promise.resolve({ announcements: [] }),
    ])
      .then(([sent, board]) => {
        if (!alive) return
        setSources({
          key: 'sources',
          broadcasts: sent.messages || [],
          announcements: board.announcements || [],
        })
        setError('')
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [fixedKind, sourcesVersion])

  const options = kind === 'broadcast' ? sources.broadcasts : sources.announcements
  // Only the announcements posted on the chosen day are offered; a new day
  // starts from that day's newest post.
  // The day always starts today; older days are reached through the date field.
  const today = todayIso()
  const shownDate = announcementDate || today
  const dayOptions =
    kind === 'announcement'
      ? options.filter((item) => (item.date || '') === shownDate)
      : options
  // A stored choice only sticks while it still exists on this tab; otherwise
  // the newest real message is shown, never a placeholder.
  const pickedItem =
    dayOptions.find((item) => item.id === pickedId) || dayOptions[0] || null
  const trackingKey = pickedItem ? `${kind}:${pickedItem.id}` : ''

  useEffect(() => {
    if (!pickedItem) return
    let alive = true
    const params =
      kind === 'broadcast'
        ? {
            kind,
            id: pickedItem.id,
            date: pickedItem.date,
            sentAt: pickedItem.sentAt,
            title: pickedItem.title,
            target: pickedItem.target,
          }
        : { kind, id: pickedItem.id }

    // A class leader opening the announcement on the board has read it, so the
    // admin sheet records the class as having viewed it.
    const read =
      leaderView && kind === 'announcement'
        ? api.viewAnnouncement(pickedItem.id).catch(() => null)
        : Promise.resolve(null)

    read
      .then(() => api.adminTracking(params))
      .then((data) => {
        if (alive) {
          setTable({ key: `${kind}:${pickedItem.id}`, data })
          setError('')
        }
      })
      .catch((err) => {
        if (alive) {
          setTable({ key: `${kind}:${pickedItem.id}`, data: null })
          setError(err.message)
        }
      })
    return () => {
      alive = false
    }
  }, [trackingKey, kind, pickedItem, uploadVersion, leaderView])

  const loading = Boolean(pickedItem) && table.key !== trackingKey
  const data = table.key === trackingKey ? table.data : null
  const summary = data?.summary || null

  const myLabel = announcementUploader ? classLabelFor(announcementUploader) : ''

  const visible = useMemo(() => {
    const needle = text.trim().toLowerCase()
    return (data?.rows || []).filter((row) => {
      // A class leader reads only their own class, never the rest of the
      // roster the admin desk tracks.
      if (myLabel && row.label !== myLabel) return false
      if (filter === 'viewed' && row.status !== 'viewed') return false
      if (filter === 'pending' && row.status !== 'pending') return false
      if (!needle) return true
      return `${row.label} ${row.leader}`.toLowerCase().includes(needle)
    })
  }, [data, filter, text, myLabel])
  // Only the admin desk starts a new announcement. A class leader adds the
  // proof photo for an announcement that already exists.
  const canPost = kind === 'announcement' && Boolean(canPostAnnouncement)
  // The admin desk writes the announcement; class leaders add proof photos in
  // the table below.
  const textComposer = Boolean(canPostAnnouncement) && !announcementUploader

  // The class leader's row is the only editable one: the announcement itself is
  // posted by the admin desk, the class photos by the leader. The draft belongs
  // to one announcement, so switching the picker never
  // carries the chosen photos over to another post. A class can send several
  // photos (or screenshots) for the same announcement.
  const MAX_OWN_PHOTOS = 8
  const ownKey = `${trackingKey}:${myLabel}`
  const photoDrafts = ownDraft.key === ownKey ? ownDraft.images : []
  const setPhotoDrafts = (images) => setOwnDraft({ key: ownKey, images })

  const saveOwnPhoto = async () => {
    if (!pickedItem) return
    if (photoDrafts.length === 0) {
      setError('Take or choose a photo first.')
      return
    }

    setSavingPhoto(true)
    setError('')
    setUploadNotice('')
    try {
      await api.uploadAnnouncementPhoto(pickedItem.id, { images: photoDrafts })
      setUploadVersion((value) => value + 1)
      setOwnDraft({ key: ownKey, images: [] })
      setUploadNotice(
        `${photoDrafts.length} photo${photoDrafts.length === 1 ? '' : 's'} saved for ${myLabel}.`
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingPhoto(false)
    }
  }

  const announcementPosted = (announcement) => {
    setCompose(false)
    setSources((prev) => ({
      ...prev,
      announcements: [announcement, ...prev.announcements],
    }))
    setAnnouncementDate(announcement.date || todayIso())
    setPickedId(announcement.id)
    setSourcesVersion((value) => value + 1)
    setUploadNotice('Announcement posted. The class leader can add the photo now.')
  }

  return (
    <div className="trk-wrap">
      {kind !== 'broadcast' ? (
      <section className="trk-bar">
        {showTypeTabs ? (
          <div className="trk-tabs" role="tablist" aria-label="Tracking type">
            {[
              { id: 'broadcast', label: 'Broadcast' },
              { id: 'announcement', label: 'Announcement' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={kind === tab.id}
                className={`trk-tab${kind === tab.id ? ' is-active' : ''}`}
                onClick={() => setInnerKind(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}

        {kind === 'broadcast' ? (
          <label className="trk-picker">
            <span>Message sent</span>
            <select
              value={pickedItem?.id || ''}
              onChange={(event) => setPickedId(event.target.value)}
              disabled={!options.length}
            >
              {options.length === 0 ? (
                <option value="">No broadcasts yet</option>
              ) : (
                options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {`${item.typeLabel || 'Message'} · ${item.title} · ${item.date} · ${item.sentAt}`}
                  </option>
                ))
              )}
            </select>
          </label>
        ) : (
          <div className="trk-day">
            <label className="trk-date">
              <span>Announcements on</span>
              <input
                type="date"
                value={shownDate}
                max={today}
                aria-label="Announcement date"
                onChange={(event) => {
                  setAnnouncementDate(event.target.value || today)
                  setPickedId('')
                }}
              />
            </label>

            {dayOptions.length > 1 ? (
              <label className="trk-picker trk-day-picker">
                <span>Posted at</span>
                <select
                  value={pickedItem?.id || ''}
                  onChange={(event) => setPickedId(event.target.value)}
                >
                  {dayOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {`${item.atIst} · ${item.title || item.caption || 'Announcement'}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : dayOptions.length === 1 ? (
              <span className="trk-day-title">
                {pickedItem.title || pickedItem.caption || 'Announcement'}
                {pickedItem.atIst ? ` · ${pickedItem.atIst} IST` : ''}
              </span>
            ) : (
              <span className="trk-day-empty">No announcements posted on this date</span>
            )}
          </div>
        )}

        {canPost ? (
          <button
            type="button"
            className="trk-new"
            onClick={() => {
              setError('')
              setUploadNotice('')
              setCompose(true)
            }}
          >
            <span aria-hidden="true">+</span> New announcement
          </button>
        ) : null}
      </section>
      ) : null}

      {error ? <div className="banner">{error}</div> : null}
      {uploadNotice ? (
        <p className="trk-upload-notice" role="status">
          {uploadNotice}
        </p>
      ) : null}

      {/* The class leader reads one row — their own class — so the filter
          pills, the summary chips and the search stay with the admin desk. */}
      {kind !== 'broadcast' && !myLabel ? (
      <section className="trk-tools">
        <div className="trk-filters" role="group" aria-label="Filter classes">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`trk-filter${filter === option.id ? ' is-active' : ''}`}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {summary ? (
          <div className="trk-summary">
            <span className="trk-chip is-viewed">
              {summary.viewed} of {summary.total} classes viewed
            </span>
            <span className="trk-chip is-pending">{summary.pending} not viewed</span>
            {summary.notSent ? (
              <span className="trk-chip is-not-sent">{summary.notSent} not sent</span>
            ) : null}
            <span className="trk-chip">{summary.photos} photo uploaded</span>
          </div>
        ) : null}

        <input
          className="trk-search"
          type="search"
          value={text}
          placeholder="Search class or class leader"
          aria-label="Search class or class leader"
          onChange={(event) => setText(event.target.value)}
        />
      </section>
      ) : null}

      <section className="trk-sheet" aria-live="polite">
        <table className="trk-table">
          <thead>
            <tr>
              <th className="trk-sno-head">S.No</th>
              <th>Class / Name</th>
              <th>View status / Timeline</th>
              <th>Uploaded photo</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="trk-empty">
                  Loading classes…
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={4} className="trk-empty">
                  {pickedItem
                    ? filter === 'all' && !text.trim()
                      ? 'No classes on the roster yet.'
                      : 'No classes match this filter.'
                    : kind === 'broadcast'
                      ? 'No broadcasts yet.'
                      : 'No announcements posted on this date.'}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={`${row.grade}-${row.section}`} className={`is-${row.status}`}>
                  <td className="trk-sno">{row.sno}</td>
                  <td className="trk-class">
                    <strong>{row.label}</strong>
                    {row.leader ? <span>Class leader · {row.leader}</span> : null}
                  </td>
                  <td>
                    <span className={`trk-status is-${row.status}`}>{statusLabel[row.status]}</span>
                    {row.status === 'viewed' ? (
                      <span className="trk-when">
                        {formatDay(row.viewedDate)}
                        {row.viewedTime ? ` · ${row.viewedTime} IST` : ''}
                        {row.viewedBy ? ` · opened by ${row.viewedBy}` : ''}
                      </span>
                    ) : row.status === 'not-sent' ? (
                      <span className="trk-when">Not addressed by this message</span>
                    ) : null}
                  </td>
                  <td className="trk-photo">
                    {row.photoUrls?.length ? (
                      <>
                        <span className="trk-photo-links">
                          {row.photoUrls.map((url, index) => (
                            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                              {row.photoUrls.length > 1 ? `Open photo ${index + 1}` : 'Open photo'}
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
                    ) : (
                      <span>No photo</span>
                    )}
                    {kind === 'announcement' &&
                    announcementUploader &&
                    pickedItem &&
                    row.label === myLabel ? (
                      <div className="trk-own">
                        <div className="trk-own-actions">
                          <button
                            type="button"
                            className="trk-upload"
                            disabled={savingPhoto}
                            onClick={() => {
                              setError('')
                              setCamera(true)
                            }}
                          >
                            Take photo
                          </button>
                        </div>
                        {photoDrafts.length ? (
                          <div className="trk-own-actions">
                            <span className="trk-own-ready">
                              {photoDrafts.length} photo{photoDrafts.length === 1 ? '' : 's'} ready
                            </span>
                            <button
                              type="button"
                              className="trk-own-save"
                              disabled={savingPhoto}
                              onClick={saveOwnPhoto}
                            >
                              {savingPhoto ? 'Saving…' : 'Save photos'}
                            </button>
                            <button
                              type="button"
                              className="tap is-quiet"
                              disabled={savingPhoto}
                              onClick={() => setPhotoDrafts([])}
                            >
                              Clear
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {compose && canPost ? (
        textComposer ? (
          <TextComposer
            onClose={() => setCompose(false)}
            onPosted={announcementPosted}
          />
        ) : (
          <PhotoComposer onClose={() => setCompose(false)} onPosted={announcementPosted} />
        )
      ) : null}

      {camera ? (
        <CameraShot
          onClose={() => setCamera(false)}
          onShot={(image) => {
            setPhotoDrafts([...photoDrafts, image].slice(0, MAX_OWN_PHOTOS))
            setError('')
            setCamera(false)
          }}
        />
      ) : null}
    </div>
  )
}

// The admin desk writes the announcement itself: a title and an optional
// description. The photo comes later from the class leader's inbox.
function TextComposer({ onClose, onPosted }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const post = async () => {
    if (!title.trim()) {
      setError('Give the announcement a title.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const payload = await api.postAnnouncement({
        title: title.trim(),
        description: description.trim(),
      })
      onPosted(payload.announcement)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ann-modal" role="presentation" onClick={onClose}>
      <div
        className="ann-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="New announcement"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ann-dialog-head">
          <h3>New announcement</h3>
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="ann-field">
          <span>Title</span>
          <input
            type="text"
            maxLength="140"
            placeholder="What is this announcement about?"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              setError('')
            }}
          />
        </label>

        <label className="ann-field">
          <span>Description (optional)</span>
          <textarea
            rows="4"
            maxLength="1000"
            placeholder="Add any detail the class leaders need."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <p className="ann-help">
          The class leader adds the photo for this announcement from their inbox.
        </p>

        {error ? <p className="ann-error">{error}</p> : null}

        <div className="ann-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ann-open" onClick={post} disabled={busy}>
            {busy ? 'Posting…' : 'Post announcement'}
          </button>
        </div>
      </div>
    </div>
  )
}
