import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import './announcement.css'

// Shared announcement screen. A photo is taken with the device camera (or
// chosen from the device), resized in the browser, then uploaded by the API to
// Cloudinary. The board below lists what the school has posted.

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

export default function AnnouncementBoard({ readOnly = false }) {
  const [state, setState] = useState({ key: '', items: [] })
  const [compose, setCompose] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0)

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

  return (
    <section className="ann-board">
      <div className="ann-head">
        <div>
          <h2>Announcement photos</h2>
          <p className="ann-sub">
            {loading
              ? 'Loading photos…'
              : state.items.length
                ? `${state.items.length} photo${state.items.length === 1 ? '' : 's'} posted`
                : 'Photos posted by the school appear here'}
          </p>
        </div>
        {readOnly ? null : (
          <button
            type="button"
            className="ann-open"
            onClick={() => {
              setNotice('')
              setError('')
              setCompose(true)
            }}
          >
            Take photo
          </button>
        )}
      </div>

      {error && !compose ? <div className="banner">{error}</div> : null}
      {notice ? (
        <p className="action-notice" role="status">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <p className="empty">Loading photos…</p>
      ) : state.items.length === 0 ? (
        <p className="empty">
          {readOnly ? 'No announcements yet.' : 'No announcements yet. Take a photo to start.'}
        </p>
      ) : (
        <ul className="ann-grid">
          {state.items.map((item) => (
            <li key={item.id}>
              <figure className="ann-card">
                <img src={item.photoUrl} alt={item.caption || 'Announcement photo'} loading="lazy" />
                <figcaption>
                  {item.caption ? <p className="ann-caption">{item.caption}</p> : null}
                  <span className="ann-meta">
                    {item.context || item.author} · {stamp(item)}
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}

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
    </section>
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
            <button type="button" className="ann-open" onClick={capture} disabled={!ready}>
              Capture photo
            </button>
          )}

          <label className="ann-file">
            <input type="file" accept="image/*" capture="environment" onChange={choose} />
            Choose from device
          </label>
        </div>

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
