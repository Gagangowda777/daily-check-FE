import { useEffect, useRef, useState } from 'react'
import { MAX_PHOTO_EDGE } from '../lib/photo.js'
import '../pages/admin/admintracking.css'

// The class leader can take the proof photo on the spot, not only pick a file.
// Shared by the announcement sheet and the broadcast archive.
export default function CameraShot({ onClose, onShot, title = 'Take a class photo' }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState('')

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

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      setError('The camera is not ready yet. Try again in a moment.')
      return
    }
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    onShot(canvas.toDataURL('image/jpeg', 0.82))
  }

  return (
    <div className="ann-modal" role="presentation" onClick={onClose}>
      <div
        className="ann-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ann-dialog-head">
          <h3>{title}</h3>
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="ann-stage">
          <video ref={videoRef} className="ann-video" playsInline autoPlay muted />
          {blocked || !ready ? (
            <p className="ann-hint">
              {blocked
                ? 'The camera is not available here. Upload a photo from the device instead.'
                : 'Starting the camera…'}
            </p>
          ) : null}
        </div>

        {error ? <p className="ann-error">{error}</p> : null}

        <div className="ann-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ann-open" onClick={capture} disabled={!ready}>
            Capture photo
          </button>
        </div>
      </div>
    </div>
  )
}
