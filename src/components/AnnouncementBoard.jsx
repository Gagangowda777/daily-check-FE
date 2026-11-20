import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import './chat.css'
import './announcement.css'

// Shared announcement screen. A photo is taken with the device camera (or
// chosen from the device), resized in the browser, then uploaded by the API to
// Cloudinary. Announcements behave like inbox messages: the list shows one row
// each, and a row is only read once somebody opens it.

const MAX_EDGE = 1280

const shrink = (source, width, height) => {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82)
}

const readFile = (file) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(shrink(image, image.naturalWidth, image.naturalHeight))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That photo could not be read.'))
    }
    image.src = url
  })

const stamp = (item) => [item.date, item.atIst].filter(Boolean).join(' · ')

const todayIso = () => new Date().toLocaleDateString('en-CA')

const shortDate = (iso) => {
  if (!iso) return ''
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

const listStamp = (item) =>
  item.date === todayIso() ? item.atIst || 'Today' : shortDate(item.date)

const dayHeading = (iso) => (iso === todayIso() ? 'Today' : shortDate(iso))

export default function AnnouncementBoard({ readOnly = false }) {
  const [state, setState] = useState({ key: '', items: [] })
  const [compose, setCompose] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0)
  const [openId, setOpenId] = useState('')

  const key = `announcements:${version}`

  useEffect(() => {
    let alive = true
    api
      .announcements()
      .then((payload) => {
        if (!alive) return
        setState({ key, items: payload.announcements || [] })
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
  const open = state.items.find((item) => item.id === openId) || null
  const unread = state.items.filter((item) => !item.seen).length

  // A row counts as read only when it is opened, as with an inbox message.
  const read = (item) => {
    setOpenId(item.id)
    if (item.seen) return
    setState((prev) => ({
      ...prev,
      items: prev.items.map((row) => (row.id === item.id ? { ...row, seen: true } : row)),
    }))
    api.viewAnnouncement(item.id).catch(() => null)
  }

  return (
    <>
      {error && !compose ? <div className="banner">{error}</div> : null}
      {notice ? (
        <p className="action-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="wa-wrap ann-wa">
        <aside className={`wa-list${open ? ' has-active' : ''}`}>
          <div className="wa-list-head">
            <div>
              <h2>Announcements</h2>
              <span className="wa-list-sub">
                {loading
                  ? 'Loading…'
                  : state.items.length
                    ? unread
                      ? `${unread} unread of ${state.items.length}`
                      : 'You are all caught up'
                    : readOnly
                      ? 'Photos the class leader posts appear here'
                      : 'Take a photo to start'}
              </span>
            </div>
            {readOnly ? null : (
              <button
                type="button"
                className="ann-post"
                aria-label="Post an announcement photo"
                title="Post an announcement photo"
                onClick={() => {
                  setNotice('')
                  setError('')
                  setCompose(true)
                }}
              >
                <span aria-hidden="true">+</span> Post
              </button>
            )}
          </div>

          {loading ? (
            <p className="wa-empty">Loading announcements…</p>
          ) : state.items.length === 0 ? (
            <p className="wa-empty">
              {readOnly
                ? 'No announcements yet. Photos the class leader posts appear here.'
                : 'No announcements yet. Take a photo to start.'}
            </p>
          ) : (
            <ul className="wa-threads">
              {state.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`wa-thread${openId === item.id ? ' is-active' : ''}`}
                    onClick={() => read(item)}
                  >
                    <span className="wa-avatar ann-avatar">
                      <img src={item.photoUrl} alt="" loading="lazy" />
                    </span>
                    <span className="wa-thread-main">
                      <span className="wa-thread-top">
                        <span className="wa-thread-name">
                          {item.caption || 'Photo announcement'}
                        </span>
                        <span className="wa-thread-time">{listStamp(item)}</span>
                      </span>
                      <span className="wa-thread-bottom">
                        <span className="wa-snippet">{item.context || item.author}</span>
                        {item.seen ? null : (
                          <span className="wa-badge" aria-label="Unread">
                            new
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className={`wa-chat${open ? ' is-open' : ''}`}>
          {!open ? (
            <div className="wa-placeholder">
              <span className="wa-placeholder-icon" aria-hidden="true">
                📷
              </span>
              <p>Pick an announcement to read it.</p>
            </div>
          ) : (
            <>
              <header className="wa-chat-head">
                <button
                  type="button"
                  className="wa-back"
                  aria-label="Back to announcements"
                  onClick={() => setOpenId('')}
                >
                  ←
                </button>
                <span className="wa-avatar ann-avatar">
                  <img src={open.photoUrl} alt="" />
                </span>
                <div className="wa-chat-title">
                  <strong>{open.caption || 'Photo announcement'}</strong>
                  <span>
                    {open.context || open.author} · {stamp(open)}
                  </span>
                </div>
              </header>

              <div className="wa-body ann-body">
                <div className="wa-day">
                  <span>{dayHeading(open.date)}</span>
                </div>
                <article className="wa-bubble ann-bubble">
                  {open.caption ? (
                    <span className="wa-bubble-title">{open.caption}</span>
                  ) : null}
                  <img
                    className="ann-bubble-photo"
                    src={open.photoUrl}
                    alt={open.caption || 'Announcement photo'}
                  />
                  <span className="wa-bubble-meta">{stamp(open)}</span>
                </article>
              </div>

              <p className="wa-readonly">
                {open.context || open.author} · visible to every dashboard
              </p>
            </>
          )}
        </section>
      </div>

      {compose && !readOnly ? (
        <PhotoComposer
          onClose={() => setCompose(false)}
          onPosted={(announcement) => {
            setCompose(false)
            setState((prev) => ({ key, items: [announcement, ...prev.items] }))
            setVersion((value) => value + 1)
            setNotice('Photo posted. It is saved in Cloudinary.')
          }}
        />
      ) : null}
    </>
  )
}

function PhotoComposer({ onClose, onPosted }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [shot, setShot] = useState('')
  const [caption, setCaption] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    let cancelled = false
    // If the permission prompt is never answered, point at the device picker
    // instead of leaving the dialog waiting on the camera.
    const hint = setTimeout(() => {
      if (!cancelled) setBlocked(true)
    }, 6000)

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setBlocked(true)
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setBlocked(false)
        setReady(true)
      } catch {
        if (!cancelled) setBlocked(true)
      }
    }

    start()

    return () => {
      cancelled = true
      clearTimeout(hint)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      setError('The camera is not ready yet. Try again in a moment.')
      return
    }
    setShot(shrink(video, video.videoWidth, video.videoHeight))
    setError('')
  }

  const choose = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setShot(await readFile(file))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  const post = async () => {
    if (!shot) {
      setError('Take or choose a photo first.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const payload = await api.postAnnouncement({ image: shot, caption: caption.trim() })
      stopCamera()
      onPosted(payload.announcement)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const close = () => {
    stopCamera()
    onClose()
  }

  return (
    <div className="ann-modal" role="presentation" onClick={close}>
      <div
        className="ann-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Post an announcement photo"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ann-dialog-head">
          <h3>Post an announcement photo</h3>
          <button type="button" className="ghost-button" onClick={close}>
            Close
          </button>
        </div>

        <div className="ann-stage">
          {shot ? (
            <img className="ann-preview" src={shot} alt="Photo to post" />
          ) : (
            <>
              <video ref={videoRef} className="ann-video" playsInline autoPlay muted />
              {blocked || !ready ? (
                <p className="ann-hint">
                  {blocked
                    ? 'The camera is not available here. Choose a photo from the device instead.'
                    : 'Starting the camera…'}
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="ann-controls">
          {shot ? (
            <button type="button" className="ghost-button" onClick={() => setShot('')}>
              Retake
            </button>
          ) : (
            <>
              <button type="button" className="ann-open" onClick={capture} disabled={!ready}>
                Capture photo
              </button>
              <label className="ann-file">
                <input type="file" accept="image/*" capture="environment" onChange={choose} />
                Take photo
              </label>
            </>
          )}

          <label className="ann-file">
            <input type="file" accept="image/*" onChange={choose} />
            Upload photo
          </label>
        </div>

        <p className="ann-help">
          Take a new photo or upload one from your device, then add the text below.
        </p>

        <label className="ann-field">
          <span>Announcement</span>
          <textarea
            rows="5"
            maxLength="1000"
            placeholder="Write what you want to announce with this photo."
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
          />
        </label>

        {error ? <p className="ann-error">{error}</p> : null}

        <div className="ann-actions">
          <button type="button" className="ghost-button" onClick={close}>
            Cancel
          </button>
          <button type="button" className="ann-open" onClick={post} disabled={busy || !shot}>
            {busy ? 'Posting…' : 'Post photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
