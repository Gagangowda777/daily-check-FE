import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { richTextToPlain, sanitizeRich } from '../lib/richText.js'
import './chat.css'

// WhatsApp-style inbox shared by the four dashboards: a conversation list on
// the left, the day's chat on the right, and a composer at the bottom.
const PEER_LABEL = {
  ADMIN: 'Admin / Coordinator',
  SUPERADMIN: 'Super Admin',
  TEACHER: 'Class Teacher',
  LEADER: 'Class Leader',
  TRANSPORT: 'Transport In-Charge',
  GATE: 'Gate / Security',
  ALL: 'School group',
}

const INBOX_ROLE = {
  admin: 'ADMIN',
  superadmin: 'SUPERADMIN',
  teacher: 'TEACHER',
  leader: 'LEADER',
  transport: 'TRANSPORT',
}

const TARGETS = {
  admin: ['SUPERADMIN', 'TEACHER', 'LEADER', 'TRANSPORT', 'GATE', 'ALL'],
  superadmin: ['ADMIN', 'TEACHER', 'LEADER', 'ALL'],
  teacher: ['LEADER', 'ADMIN', 'ALL'],
  leader: ['TEACHER', 'ADMIN', 'ALL'],
  // The transport desk can only reply to the admin and the school group.
  transport: ['ADMIN', 'ALL'],
}

const initials = (name = '') => {
  const parts = String(name)
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean)
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || '?'
  )
}

const clock = (message) => message.sentAtIst || message.sentAt || ''

// Voice clips show minutes and seconds, both while recording and in the bubble.
const spokenTime = (seconds) => {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const RECORD_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

// Audio files chosen from the device, separate from recorded voice messages.
const AUDIO_FILE_MIMES = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  webm: 'audio/webm',
  flac: 'audio/flac',
}

const AUDIO_FILE_ACCEPT = '.mp3,.wav,.m4a,.aac,.ogg,.oga,.webm,.flac'

// Photos shared in the chat. The picked file is uploaded as it is, so the
// receiver opens the same image that was chosen.
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'

// Documents shared in the chat. The backend repeats these checks and also
// inspects the file signature before storing it.
const DOC_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv']
const DOC_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv'

// One picker handles every supported chat attachment; the chosen file is
// routed to the image, audio or document preview by its type.
const ANY_FILE_ACCEPT = `${DOC_ACCEPT},${IMAGE_ACCEPT},${AUDIO_FILE_ACCEPT}`
const DOC_LABELS = {
  pdf: 'PDF document',
  doc: 'Word document',
  docx: 'Word document',
  xls: 'Excel sheet',
  xlsx: 'Excel sheet',
  ppt: 'PowerPoint',
  pptx: 'PowerPoint',
  txt: 'Text file',
  csv: 'CSV file',
}

const extensionOf = (name) => String(name || '').split('.').pop()?.toLowerCase() || ''

const fileSizeLabel = (bytes) => {
  const size = Number(bytes) || 0
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  if (size >= 1024) return `${Math.round(size / 1024)} KB`
  return `${size} B`
}

const documentLabel = (name, mime) =>
  DOC_LABELS[extensionOf(name)] || mime || 'File'

// The browser reads the length from the file itself. Formats that do not carry
// a duration stay unknown until the player loads them.
const audioDurationOf = (url) =>
  new Promise((resolve) => {
    const probe = new Audio()
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      probe.removeAttribute('src')
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), 4000)
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => {
      clearTimeout(timer)
      const length = probe.duration
      finish(Number.isFinite(length) && length > 0 ? length : null)
    }
    probe.onerror = () => {
      clearTimeout(timer)
      finish(null)
    }
    probe.src = url
  })

const blobToDataUrl = (blob, fallback = 'audio/webm') =>
  new Promise((resolve, reject) => {
    // Drop the codec suffix so the backend sees a plain audio mime type.
    const type = (blob.type || fallback).split(';')[0]
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('That recording could not be read. Record it again.'))
    reader.readAsDataURL(new Blob([blob], { type }))
  })

const dayKeyOf = (message) => {
  const iso = message.at || ''
  const when = iso ? new Date(iso) : null
  if (!when || Number.isNaN(when.getTime())) return 'unknown'
  const month = String(when.getMonth() + 1).padStart(2, '0')
  const day = String(when.getDate()).padStart(2, '0')
  return `${when.getFullYear()}-${month}-${day}`
}

const todayKey = () => dayKeyOf({ at: new Date().toISOString() })

const dayHeading = (key) => {
  if (key === 'unknown') return 'Earlier'
  if (key === todayKey()) return 'Today'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (key === dayKeyOf({ at: yesterday.toISOString() })) return 'Yesterday'
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Thread list stamps follow WhatsApp: a clock for today, a short date before.
const listStamp = (message) => {
  if (!message) return ''
  return dayKeyOf(message) === todayKey()
    ? clock(message)
    : dayHeading(dayKeyOf(message))
}

export default function ChatInbox({ role, date, version = 0, onSent }) {
  const myRole = INBOX_ROLE[role] || 'ADMIN'
  const targets = TARGETS[role] || ['ADMIN', 'ALL']

  const [state, setState] = useState({ key: '', messages: [] })
  const [refresh, setRefresh] = useState(0)
  const [openKey, setOpenKey] = useState('')
  const [draft, setDraft] = useState('')
  const [marks, setMarks] = useState({ bold: false, italic: false, underline: false })
  const editorRef = useRef(null)
  const bodyRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [picker, setPicker] = useState(false)
  const [voice, setVoice] = useState(null)
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [voiceError, setVoiceError] = useState('')
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const tickRef = useRef(null)
  const elapsedRef = useRef(0)
  const discardRef = useRef(false)
  const anyFileRef = useRef(null)
  const [attachment, setAttachment] = useState(null)
  const [attachmentError, setAttachmentError] = useState('')
  const [image, setImage] = useState(null)
  const [imageError, setImageError] = useState('')
  const [previewImage, setPreviewImage] = useState(null)
  const [documentFile, setDocumentFile] = useState(null)
  const [documentError, setDocumentError] = useState('')
  const [uploadPercent, setUploadPercent] = useState(null)

  const key = `${role}:${version}:${refresh}`

  // A recording in progress must not keep the microphone open after the chat
  // closes or the component unmounts.
  useEffect(
    () => () => {
      clearInterval(tickRef.current)
      if (recorderRef.current?.state === 'recording') {
        discardRef.current = true
        recorderRef.current.stop()
      }
      streamRef.current?.getTracks().forEach((track) => track.stop())
    },
    []
  )

  useEffect(
    () => () => {
      if (voice?.url) URL.revokeObjectURL(voice.url)
    },
    [voice]
  )

  useEffect(
    () => () => {
      if (attachment?.url) URL.revokeObjectURL(attachment.url)
    },
    [attachment]
  )

  useEffect(
    () => () => {
      if (image?.url) URL.revokeObjectURL(image.url)
    },
    [image]
  )

  useEffect(() => {
    if (!previewImage) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setPreviewImage(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewImage])

  useEffect(() => {
    let alive = true
    api
      .inboxMessages({})
      .then((payload) => {
        if (!alive) return
        setState({ key, messages: payload.messages || [] })
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

  const threads = useMemo(() => {
    const peerOf = (message) => {
      // Anything sent to every dashboard belongs to the school group, whether
      // it arrived here or the user posted it themselves.
      if (message.toAll) return 'ALL'
      const other = message.mine ? message.toRole || 'ALL' : message.fromRole || 'ADMIN'
      const peer = String(other).toUpperCase()
      if (message.mine && peer === myRole) return 'ALL'
      return peer
    }

    const list = loading ? [] : state.messages

    // A group send stores one copy per dashboard and the sender's inbox holds
    // all of them. Keep a single bubble, preferring the sender's own copy.
    const groupCopies = new Map()
    for (const message of list) {
      if (!message.toAll || !message.mine) continue
      const copyKey = `${message.sentAt || ''}|${message.fromRole || ''}|${message.title || ''}|${message.body || ''}`
      const kept = groupCopies.get(copyKey)
      if (!kept || message.toRole === myRole) groupCopies.set(copyKey, message)
    }
    const keptIds = new Set([...groupCopies.values()].map((message) => message.id))

    const map = new Map()
    for (const message of list) {
      if (message.toAll && message.mine && !keptIds.has(message.id)) continue
      const peer = peerOf(message)
      if (!map.has(peer)) {
        map.set(peer, { key: peer, label: PEER_LABEL[peer] || peer, items: [], unread: 0, lastAt: '' })
      }
      const thread = map.get(peer)
      thread.items.push(message)
      thread.lastAt = message.at || clock(message)
      if (!message.mine && !message.readAt) thread.unread += 1
      // Keep the role label unless the thread belongs to one person, so a
      // stray sender name can never rename the whole admin conversation.
      if (
        !message.mine &&
        message.fromContext &&
        peer !== 'ALL' &&
        peer !== 'ADMIN' &&
        peer !== 'SUPERADMIN' &&
        !thread.labelSet
      ) {
        thread.label = message.fromContext
        thread.labelSet = true
      }
    }
    for (const thread of map.values()) {
      thread.items.sort((a, b) =>
        String(a.at || a.sentAt || '').localeCompare(String(b.at || b.sentAt || ''))
      )
      thread.last = thread.items[thread.items.length - 1]
    }
    return [...map.values()].sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)))
  }, [state.messages, loading, myRole])

  const openThread = threads.find((thread) => thread.key === openKey)
  const pickerThread =
    openKey && !openThread
      ? { key: openKey, label: PEER_LABEL[openKey] || openKey, items: [], unread: 0 }
      : null
  const active = openThread || pickerThread

  const unreadTotal = threads.reduce((total, thread) => total + thread.unread, 0)

  // Day separators, as in WhatsApp, so older messages keep their date.
  const dayGroups = []
  for (const message of active?.items || []) {
    const dayKey = dayKeyOf(message)
    const group = dayGroups[dayGroups.length - 1]
    if (group && group.key === dayKey) group.items.push(message)
    else dayGroups.push({ key: dayKey, label: dayHeading(dayKey), items: [message] })
  }

  // A conversation opens on its newest message. The same pin runs when a new
  // message arrives and after photos finish loading, so reading never starts
  // at the top of a long thread.
  const activeKey = active?.key || ''
  const activeCount = active?.items.length || 0
  useEffect(() => {
    const body = bodyRef.current
    if (!body || !activeKey) return undefined
    const pin = () => {
      body.scrollTop = body.scrollHeight
    }
    pin()
    const frames = [requestAnimationFrame(pin), requestAnimationFrame(pin)]
    const images = [...body.querySelectorAll('img')]
    images.forEach((image) => image.addEventListener('load', pin))
    return () => {
      frames.forEach((id) => cancelAnimationFrame(id))
      images.forEach((image) => image.removeEventListener('load', pin))
    }
  }, [activeKey, activeCount])

  const markRead = async (thread) => {
    const unread = thread.items.filter((message) => !message.mine && !message.readAt)
    await Promise.all(
      unread.map((message) =>
        api.markInboxRead(message.id, { kind: message.kind }).catch(() => null)
      )
    )
    if (unread.length) {
      setRefresh((value) => value + 1)
      // The dashboard's unread badge counts the same rows, so it is told to
      // reload once a conversation has been read.
      onSent?.()
    }
  }

  const open = (threadKey) => {
    setOpenKey(threadKey)
    setPicker(false)
    setNotice('')
    setError('')
    const thread = threads.find((item) => item.key === threadKey)
    if (thread?.unread) markRead(thread)
  }

  const startChat = (target) => {
    setPicker(false)
    setNotice('')
    setError('')
    setOpenKey(target)
  }

  const syncMarks = () => {
    setMarks({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
    })
  }

  const format = (command) => {
    editorRef.current?.focus()
    document.execCommand(command, false)
    setDraft(editorRef.current?.innerHTML || '')
    syncMarks()
  }

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const clearTicker = () => {
    clearInterval(tickRef.current)
    tickRef.current = null
  }

  const MIC_BLOCKED =
    'Microphone access is blocked. Allow microphone permission for this site, then try again.'

  const microphoneError = (error) => {
    if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return MIC_BLOCKED
    if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
      return 'No microphone was found. Connect one and try again.'
    }
    if (error?.name === 'NotReadableError') {
      return 'The microphone is busy in another app. Close it and try again.'
    }
    if (error?.name === 'TimeoutError') {
      return 'The microphone did not respond. Allow microphone permission for this site, then try again.'
    }
    return 'Could not start recording. Check your microphone and try again.'
  }

  // A browser can leave the permission prompt pending with no microphone
  // available, so the request is bounded and a late stream is closed again.
  const requestMicrophone = () =>
    new Promise((resolve, reject) => {
      let settled = false
      const timer = setTimeout(() => {
        settled = true
        const timeout = new Error('Microphone request timed out.')
        timeout.name = 'TimeoutError'
        reject(timeout)
      }, 15000)
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          clearTimeout(timer)
          if (settled) {
            stream.getTracks().forEach((track) => track.stop())
            return
          }
          resolve(stream)
        })
        .catch((error) => {
          clearTimeout(timer)
          if (!settled) reject(error)
        })
    })

  const startRecording = async () => {
    setVoiceError('')
    setAttachmentError('')
    setError('')
    setNotice('')
    if (attachment) cancelAttachment()
    if (image) cancelImage()
    if (documentFile) cancelDocument()
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      setVoiceError('Voice recording is not supported in this browser. Try Chrome, Edge or Safari.')
      return
    }
    const permission = await navigator.permissions
      ?.query?.({ name: 'microphone' })
      .then((status) => status.state)
      .catch(() => null)
    if (permission === 'denied') {
      setVoiceError(MIC_BLOCKED)
      return
    }
    try {
      const stream = await requestMicrophone()
      streamRef.current = stream
      const mimeType = RECORD_TYPES.find((type) => window.MediaRecorder.isTypeSupported?.(type))
      const recorder = mimeType
        ? new window.MediaRecorder(stream, { mimeType })
        : new window.MediaRecorder(stream)
      chunksRef.current = []
      discardRef.current = false
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        clearTicker()
        stopTracks()
        setRecording(false)
        setVoiceError('The recording stopped unexpectedly. Try again.')
      }
      recorder.onstop = () => {
        clearTicker()
        stopTracks()
        setRecording(false)
        const chunks = chunksRef.current
        chunksRef.current = []
        if (discardRef.current) return
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' })
        if (!blob.size) {
          setVoiceError('Nothing was recorded. Check your microphone and try again.')
          return
        }
        const seconds = Math.max(1, Math.round(elapsedRef.current))
        setVoice({ blob, url: URL.createObjectURL(blob), seconds })
        setRecordSeconds(seconds)
      }

      elapsedRef.current = 0
      setRecordSeconds(0)
      recorder.start()
      setRecording(true)
      // The ticker is the clip length too, so recording never reads a clock
      // during render and the stored duration matches what was shown.
      tickRef.current = setInterval(() => {
        elapsedRef.current += 0.5
        setRecordSeconds(Math.floor(elapsedRef.current))
      }, 500)
    } catch (err) {
      stopTracks()
      setRecording(false)
      setVoiceError(microphoneError(err))
    }
  }

  const stopRecording = (discard = false) => {
    discardRef.current = discard
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    else {
      clearTicker()
      stopTracks()
      setRecording(false)
    }
    if (discard) setRecordSeconds(0)
  }

  const cancelVoice = () => {
    if (voice?.url) URL.revokeObjectURL(voice.url)
    setVoice(null)
    setRecordSeconds(0)
    setVoiceError('')
  }

  const sendVoice = async () => {
    if (!voice) return
    if (!targets.includes(openKey)) {
      setVoiceError('You cannot message this recipient.')
      return
    }
    setBusy(true)
    setVoiceError('')
    setError('')
    try {
      const dataUrl = await blobToDataUrl(voice.blob)
      await api.sendInboxMessage({
        to: openKey,
        audio: { dataUrl, duration: voice.seconds },
        date,
      })
      URL.revokeObjectURL(voice.url)
      setVoice(null)
      setRecordSeconds(0)
      setRefresh((value) => value + 1)
      onSent?.()
    } catch (err) {
      setVoiceError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const cancelAttachment = () => {
    if (attachment?.url) URL.revokeObjectURL(attachment.url)
    setAttachment(null)
    setAttachmentError('')
  }

  const cancelImage = () => {
    if (image?.url) URL.revokeObjectURL(image.url)
    setImage(null)
    setImageError('')
  }

  const cancelDocument = () => {
    setDocumentFile(null)
    setDocumentError('')
    setUploadPercent(null)
  }

  const clearMediaPreviews = () => {
    if (recording) stopRecording(true)
    cancelVoice()
    cancelAttachment()
    cancelImage()
    cancelDocument()
  }

  const chooseDocument = (event) => {
    const chosen = event.target.files?.[0]
    event.target.value = ''
    if (!chosen) return
    setDocumentError('')
    setVoiceError('')
    setAttachmentError('')
    setImageError('')
    setError('')
    setNotice('')
    clearMediaPreviews()

    const extension = extensionOf(chosen.name)
    if (!DOC_EXTENSIONS.includes(extension)) {
      setDocumentError(
        'That file type is not supported. Use PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT or CSV.'
      )
      return
    }
    if (chosen.size > 5 * 1024 * 1024) {
      setDocumentError('That file is larger than 5 MB. Choose a smaller file.')
      return
    }
    setDocumentFile({
      file: chosen,
      name: chosen.name,
      size: chosen.size,
      mime: chosen.type || 'application/octet-stream',
      extension,
    })
  }

  const sendDocument = async () => {
    if (!documentFile) return
    if (!targets.includes(openKey)) {
      setDocumentError('You cannot message this recipient.')
      return
    }
    setBusy(true)
    setDocumentError('')
    setError('')
    setUploadPercent(0)
    try {
      const dataUrl = await blobToDataUrl(documentFile.file, documentFile.mime)
      await api.sendInboxMessageWithProgress(
        {
          to: openKey,
          document: {
            dataUrl,
            name: documentFile.name,
            mime: documentFile.mime,
            size: documentFile.size,
          },
          date,
        },
        (percent) => setUploadPercent(percent)
      )
      setDocumentFile(null)
      setUploadPercent(null)
      setRefresh((value) => value + 1)
      onSent?.()
    } catch (err) {
      setDocumentError(err.message)
      setUploadPercent(null)
    } finally {
      setBusy(false)
    }
  }

  const chooseImage = (event) => {
    const chosen = event.target.files?.[0]
    event.target.value = ''
    if (!chosen) return
    setImageError('')
    setVoiceError('')
    setAttachmentError('')
    setError('')
    setNotice('')
    if (recording) stopRecording(true)
    cancelVoice()
    cancelAttachment()
    cancelDocument()

    const extension = String(chosen.name || '').split('.').pop()?.toLowerCase() || ''
    if (!IMAGE_TYPES.includes(chosen.type) || !['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
      setImageError('That image is not supported. Choose a JPG, PNG or WEBP image.')
      return
    }
    if (chosen.size > 4 * 1024 * 1024) {
      setImageError('That image is larger than 4 MB. Choose a smaller image.')
      return
    }
    setImage({
      file: chosen,
      url: URL.createObjectURL(chosen),
      name: chosen.name,
    })
  }

  const sendImage = async () => {
    if (!image) return
    if (!targets.includes(openKey)) {
      setImageError('You cannot message this recipient.')
      return
    }
    setBusy(true)
    setImageError('')
    setError('')
    try {
      const dataUrl = await blobToDataUrl(image.file, 'image/jpeg')
      await api.sendInboxMessage({
        to: openKey,
        image: { dataUrl, name: image.name },
        date,
      })
      URL.revokeObjectURL(image.url)
      setImage(null)
      setRefresh((value) => value + 1)
      onSent?.()
    } catch (err) {
      setImageError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const chooseAudioFile = async (event) => {
    const chosen = event.target.files?.[0]
    event.target.value = ''
    if (!chosen) return
    setAttachmentError('')
    setVoiceError('')
    setError('')
    setNotice('')
    if (recording) stopRecording(true)
    cancelVoice()
    cancelImage()
    cancelDocument()

    const extension = String(chosen.name || '').split('.').pop()?.toLowerCase() || ''
    const mime = (chosen.type || AUDIO_FILE_MIMES[extension] || '').split(';')[0].toLowerCase()
    if (!AUDIO_FILE_MIMES[extension] || !mime.startsWith('audio/')) {
      setAttachmentError(
        'That file is not supported. Choose an MP3, WAV, M4A, AAC, OGG, WEBM or FLAC audio file.'
      )
      return
    }
    if (chosen.size > 5 * 1024 * 1024) {
      setAttachmentError('That audio file is larger than 5 MB. Choose a smaller file.')
      return
    }
    const url = URL.createObjectURL(chosen)
    const duration = await audioDurationOf(url)
    setAttachment({ file: chosen, url, name: chosen.name, duration, mime })
  }

  const chooseAnyFile = (event) => {
    const chosen = event.target.files?.[0]
    if (!chosen) return
    const extension = extensionOf(chosen.name)
    const mime = String(chosen.type || '').toLowerCase()
    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
      chooseImage(event)
      return
    }
    const audioMime = (chosen.type || AUDIO_FILE_MIMES[extension] || '')
      .split(';')[0]
      .toLowerCase()
    if (AUDIO_FILE_MIMES[extension] || audioMime.startsWith('audio/')) {
      chooseAudioFile(event)
      return
    }
    chooseDocument(event)
  }

  const sendAttachment = async () => {
    if (!attachment) return
    if (!targets.includes(openKey)) {
      setAttachmentError('You cannot message this recipient.')
      return
    }
    setBusy(true)
    setAttachmentError('')
    setError('')
    try {
      const dataUrl = await blobToDataUrl(attachment.file, attachment.mime)
      await api.sendInboxMessage({
        to: openKey,
        attachment: {
          dataUrl,
          name: attachment.name,
          duration: attachment.duration,
        },
        date,
      })
      URL.revokeObjectURL(attachment.url)
      setAttachment(null)
      setRefresh((value) => value + 1)
      onSent?.()
    } catch (err) {
      setAttachmentError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const send = async (event) => {
    event?.preventDefault?.()
    const body = sanitizeRich(draft || editorRef.current?.innerHTML || '')
    if (richTextToPlain(body).trim().length < 3) {
      setError('Write a message first.')
      return
    }
    if (!targets.includes(openKey)) {
      setError('You cannot message this recipient.')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.sendInboxMessage({ to: openKey, body, date })
      if (editorRef.current) editorRef.current.innerHTML = ''
      setDraft('')
      setMarks({ bold: false, italic: false, underline: false })
      setRefresh((value) => value + 1)
      onSent?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wa-wrap">
      {error && !active ? <div className="banner">{error}</div> : null}

      <aside className={`wa-list${active ? ' has-active' : ''}`}>
        <div className="wa-list-head">
          <div>
            <h2>Chats</h2>
            <span className="wa-list-sub">
              {loading ? 'Loading…' : unreadTotal ? `${unreadTotal} unread` : 'You are all caught up'}
            </span>
          </div>
          <button
            type="button"
            className="wa-new"
            aria-label="Start a new chat"
            onClick={() => {
              setPicker((value) => !value)
              setError('')
              setNotice('')
            }}
          >
            +
          </button>
        </div>

        {picker ? (
          <div className="wa-picker">
            <span className="wa-picker-label">Message someone</span>
            <div className="wa-picker-list">
              {targets.map((target) => (
                <button key={target} type="button" className="wa-chip" onClick={() => startChat(target)}>
                  {PEER_LABEL[target] || target}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {loading ? (
          <p className="wa-empty">Loading chats…</p>
        ) : threads.length === 0 ? (
          <p className="wa-empty">No conversations yet. Tap + to start one.</p>
        ) : (
          <ul className="wa-threads">
            {threads.map((thread) => (
              <li key={thread.key}>
                <button
                  type="button"
                  className={`wa-thread${openKey === thread.key ? ' is-active' : ''}`}
                  onClick={() => open(thread.key)}
                >
                  <span className="wa-avatar">{initials(thread.label)}</span>
                  <span className="wa-thread-main">
                    <span className="wa-thread-top">
                      <span className="wa-thread-name">{thread.label}</span>
                      <span className="wa-thread-time">{listStamp(thread.last)}</span>
                    </span>
                    <span className="wa-thread-bottom">
                      <span className="wa-snippet">
                        {thread.last?.mine ? 'You: ' : ''}
                        {richTextToPlain(thread.last?.body) ||
                          thread.last?.attachmentName ||
                          thread.last?.fileName ||
                          (thread.last?.imageUrl ? 'Photo' : '') ||
                          (thread.last?.audioUrl ? 'Voice message' : '') ||
                          thread.last?.title ||
                          ''}
                      </span>
                      {thread.unread ? <span className="wa-badge">{thread.unread}</span> : null}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className={`wa-chat${active ? ' is-open' : ''}`}>
        {!active ? (
          <div className="wa-placeholder">
            <span className="wa-placeholder-icon" aria-hidden="true">
              💬
            </span>
            <p>Pick a conversation to read its messages.</p>
          </div>
        ) : (
          <>
            <header className="wa-chat-head">
              <button
                type="button"
                className="wa-back"
                aria-label="Back to chats"
                onClick={() => {
                  setOpenKey('')
                  setNotice('')
                  setError('')
                }}
              >
                ←
              </button>
              <span className="wa-avatar">{initials(active.label)}</span>
              <div className="wa-chat-title">
                <strong>{active.label}</strong>
                <span>
                  {active.key === 'ALL'
                    ? 'Group chat · every dashboard sees these messages'
                    : 'Direct conversation · visible to this dashboard only'}
                </span>
              </div>
            </header>

            <div className="wa-body" ref={bodyRef}>
              {active.items.length === 0 ? (
                <p className="wa-chat-empty">
                  No messages here yet.{targets.includes(active.key) ? ' Say hello below.' : ''}
                </p>
              ) : (
                dayGroups.map((group) => (
                  <Fragment key={group.key}>
                    <div className="wa-day">
                      <span>{group.label}</span>
                    </div>
                    {group.items.map((message) => (
                      <article
                        key={`${message.kind}-${message.id}`}
                        className={`wa-bubble${message.mine ? ' is-mine' : ''}${
                          active.key === 'ALL' ? ' is-group' : ''
                        }`}
                      >
                        {!message.mine && active.key === 'ALL' ? (
                          <span className="wa-bubble-sender">
                            {message.fromName ||
                              PEER_LABEL[String(message.fromRole || '').toUpperCase()] ||
                              'Member'}
                          </span>
                        ) : null}
                        {!message.audioUrl &&
                        !message.attachmentUrl &&
                        !message.imageUrl &&
                        !message.fileUrl &&
                        message.title &&
                        message.title !== message.body ? (
                          <span className="wa-bubble-title">{message.title}</span>
                        ) : null}
                        {message.fileUrl ? (
                          <div className="wa-doc">
                            <span className="wa-doc-chip">
                              {extensionOf(message.fileName || '').toUpperCase() || 'FILE'}
                            </span>
                            <div className="wa-doc-main">
                              <span className="wa-doc-name" title={message.fileName || 'Document'}>
                                {message.fileName || 'Document'}
                              </span>
                              <span className="wa-doc-meta">
                                {documentLabel(message.fileName, message.fileMime)}
                                {message.fileSize ? ` · ${fileSizeLabel(message.fileSize)}` : ''}
                              </span>
                            </div>
                            <div className="wa-doc-actions">
                              <a
                                className="wa-doc-link"
                                href={api.fileUrl(message.fileUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Open
                              </a>
                              <a
                                className="wa-doc-link"
                                href={`${api.fileUrl(message.fileUrl)}${
                                  api.fileUrl(message.fileUrl).includes('?') ? '&' : '?'
                                }download=1`}
                                download={message.fileName || true}
                                rel="noopener noreferrer"
                              >
                                Download
                              </a>
                            </div>
                          </div>
                        ) : message.imageUrl ? (
                          <button
                            type="button"
                            className="wa-image-btn"
                            title="Open image preview"
                            onClick={() =>
                              setPreviewImage({
                                url: message.imageUrl,
                                name: message.imageName || 'Image',
                              })
                            }
                          >
                            <img
                              className="wa-image"
                              src={message.imageUrl}
                              alt={message.imageName || 'Shared image'}
                              loading="lazy"
                            />
                          </button>
                        ) : message.attachmentUrl ? (
                          <div className="wa-file">
                            <span className="wa-file-name" title={message.attachmentName || 'Audio file'}>
                              {message.attachmentName || 'Audio file'}
                            </span>
                            <VoicePlayer
                              url={message.attachmentUrl}
                              duration={message.attachmentDuration}
                              mine={message.mine}
                            />
                          </div>
                        ) : message.audioUrl ? (
                          <VoicePlayer
                            url={message.audioUrl}
                            duration={message.audioDuration}
                            mine={message.mine}
                          />
                        ) : (
                          <p
                            className="wa-bubble-text"
                            dangerouslySetInnerHTML={{ __html: sanitizeRich(message.body) }}
                          />
                        )}
                        <span className="wa-bubble-meta">
                          {clock(message)}
                          {message.mine ? (
                            <span className={`wa-ticks${message.readAt ? ' is-read' : ''}`}>
                              {message.readAt ? ' ✓✓ read' : ' ✓ sent'}
                            </span>
                          ) : message.readAt ? (
                            ` · viewed ${message.readAt}`
                          ) : null}
                        </span>
                        {!message.mine &&
                        message.kind === 'leader' &&
                        UPLOAD_COPY[message.type] ? (
                          <ClassProof
                            message={message}
                            onUploaded={() => setRefresh((value) => value + 1)}
                          />
                        ) : null}
                      </article>
                    ))}
                  </Fragment>
                ))
              )}
            </div>

            {targets.includes(active.key) ? (
              <form className="wa-compose" onSubmit={send}>
                {recording || voice ? (
                  <div className={`wa-voice-bar${recording ? ' is-recording' : ''}`}>
                    {recording ? (
                      <>
                        <span className="wa-voice-dot" aria-hidden="true" />
                        <span className="wa-voice-label">
                          Recording {spokenTime(recordSeconds)}
                        </span>
                        <button
                          type="button"
                          className="wa-voice-stop"
                          onClick={() => stopRecording(false)}
                        >
                          Stop
                        </button>
                        <button
                          type="button"
                          className="wa-voice-cancel"
                          onClick={() => stopRecording(true)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <audio className="wa-voice-preview" src={voice.url} controls preload="metadata" />
                        <span className="wa-voice-label">{spokenTime(voice.seconds)}</span>
                        <button
                          type="button"
                          className="wa-voice-send"
                          disabled={busy}
                          onClick={sendVoice}
                        >
                          {busy ? 'Sending…' : 'Send voice'}
                        </button>
                        <button
                          type="button"
                          className="wa-voice-cancel"
                          disabled={busy}
                          onClick={cancelVoice}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                ) : attachment ? (
                  <div className="wa-voice-bar wa-file-bar">
                    <span className="wa-file-name" title={attachment.name}>
                      {attachment.name}
                    </span>
                    <audio
                      className="wa-voice-preview"
                      src={attachment.url}
                      controls
                      preload="metadata"
                    />
                    {attachment.duration ? (
                      <span className="wa-voice-label">{spokenTime(attachment.duration)}</span>
                    ) : null}
                    <button
                      type="button"
                      className="wa-voice-send"
                      disabled={busy}
                      onClick={sendAttachment}
                    >
                      {busy ? 'Sending…' : 'Send file'}
                    </button>
                    <button
                      type="button"
                      className="wa-voice-cancel"
                      disabled={busy}
                      onClick={cancelAttachment}
                    >
                      Cancel
                    </button>
                  </div>
                ) : image ? (
                  <div className="wa-voice-bar wa-image-bar">
                    <img className="wa-image-thumb" src={image.url} alt={image.name} />
                    <span className="wa-file-name" title={image.name}>
                      {image.name}
                    </span>
                    <button
                      type="button"
                      className="wa-voice-send"
                      disabled={busy}
                      onClick={sendImage}
                    >
                      {busy ? 'Sending…' : 'Send image'}
                    </button>
                    <button
                      type="button"
                      className="wa-voice-cancel"
                      disabled={busy}
                      onClick={cancelImage}
                    >
                      Cancel
                    </button>
                  </div>
                ) : documentFile ? (
                  <div className="wa-voice-bar wa-doc-bar">
                    <span className="wa-doc-chip">{documentFile.extension.toUpperCase()}</span>
                    <span className="wa-doc-preview">
                      <span className="wa-file-name" title={documentFile.name}>
                        {documentFile.name}
                      </span>
                      <span className="wa-doc-meta">
                        {DOC_LABELS[documentFile.extension] || 'File'} ·{' '}
                        {fileSizeLabel(documentFile.size)}
                      </span>
                    </span>
                    {busy ? (
                      <span className="wa-upload">
                        <span className="wa-upload-track">
                          <span
                            className="wa-upload-fill"
                            style={{ width: `${uploadPercent ?? 0}%` }}
                          />
                        </span>
                        <span className="wa-upload-label">
                          {uploadPercent === null ? 'Uploading…' : `${uploadPercent}%`}
                        </span>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="wa-voice-send"
                      disabled={busy}
                      onClick={sendDocument}
                    >
                      {busy ? 'Uploading…' : 'Send file'}
                    </button>
                    <button
                      type="button"
                      className="wa-voice-cancel"
                      disabled={busy}
                      onClick={cancelDocument}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                <div className="wa-compose-main">
                  <div className="wa-compose-tools">
                  <div className="wa-format" role="toolbar" aria-label="Text formatting">
                    <button
                      type="button"
                      className={`wa-format-btn${marks.bold ? ' is-active' : ''}`}
                      aria-pressed={marks.bold}
                      aria-label="Bold"
                      title="Bold"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => format('bold')}
                    >
                      <strong>B</strong>
                    </button>
                    <button
                      type="button"
                      className={`wa-format-btn${marks.italic ? ' is-active' : ''}`}
                      aria-pressed={marks.italic}
                      aria-label="Italic"
                      title="Italic"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => format('italic')}
                    >
                      <em>I</em>
                    </button>
                    <button
                      type="button"
                      className={`wa-format-btn${marks.underline ? ' is-active' : ''}`}
                      aria-pressed={marks.underline}
                      aria-label="Underline"
                      title="Underline"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => format('underline')}
                    >
                      <u>U</u>
                    </button>
                  </div>
                    <div className="wa-compose-attachments">
          <button
            type="button"
            className="wa-attach"
            aria-label="Attach a file"
            title="Attach a file"
            onClick={() => {
              setDocumentError('')
              setImageError('')
              setVoiceError('')
              setAttachmentError('')
              anyFileRef.current?.click()
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <input
            ref={anyFileRef}
            type="file"
            accept={ANY_FILE_ACCEPT}
            hidden
            onChange={chooseAnyFile}
          />


          <button
            type="button"
            className="wa-mic"
            aria-label="Record a voice message"
            title="Record a voice message"
            onClick={startRecording}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12h-2Z"
              />
            </svg>
          </button>
                    </div>
                  </div>
                  <div className="wa-compose-row">
                  <div
                    ref={editorRef}
                    className="wa-input wa-editor"
                    contentEditable
                    role="textbox"
                    aria-multiline="true"
                    aria-label="Message"
                    data-placeholder={
                      active.key === 'ALL' ? 'Message the school group' : 'Type a message'
                    }
                    suppressContentEditableWarning
                    onInput={(event) => {
                      setDraft(event.currentTarget.innerHTML)
                      syncMarks()
                    }}
                    onKeyUp={syncMarks}
                    onMouseUp={syncMarks}
                    onPaste={(event) => {
                      // Paste as plain text so clipboard HTML can never run here.
                      event.preventDefault()
                      const text = event.clipboardData?.getData('text/plain') || ''
                      if (text) document.execCommand('insertText', false, text)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        send()
                      }
                    }}
                  />
                    <button type="submit" className="wa-send" disabled={busy}>
                      {busy ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
                  </>
                )}
                {voiceError ? <p className="wa-voice-error">{voiceError}</p> : null}
                {attachmentError ? <p className="wa-voice-error">{attachmentError}</p> : null}
                {imageError ? <p className="wa-voice-error">{imageError}</p> : null}
                {documentError ? <p className="wa-voice-error">{documentError}</p> : null}
              </form>
            ) : (
              <p className="wa-readonly">You can read this conversation but not reply here.</p>
            )}

            {error ? <p className="wa-error">{error}</p> : null}
            {notice ? <p className="wa-notice">{notice}</p> : null}
          </>
        )}
      </section>

      {previewImage ? (
        <div
          className="wa-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${previewImage.name}`}
          onClick={() => setPreviewImage(null)}
        >
          <button
            type="button"
            className="wa-lightbox-close"
            aria-label="Close image preview"
            onClick={() => setPreviewImage(null)}
          >
            ×
          </button>
          <img
            className="wa-lightbox-img"
            src={previewImage.url}
            alt={previewImage.name}
            onClick={(event) => event.stopPropagation()}
          />
          <span className="wa-lightbox-name">{previewImage.name}</span>
        </div>
      ) : null}
    </div>
  )
}

const MAX_PICTURE_EDGE = 1280

// Shrink on the device before uploading, exactly like the announcement photos,
// so a phone picture does not cross the wire at full resolution.
const pictureFromFile = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(
        1,
        MAX_PICTURE_EDGE / Math.max(image.naturalWidth, image.naturalHeight)
      )
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That picture could not be read.'))
    }
    image.src = url
  })

// A received voice message: play/pause, a seekable progress line and the clip
// length, so the chat needs no extra audio app.
function VoicePlayer({ url, duration, mine = false }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState(Number(duration) || 0)
  const [failed, setFailed] = useState(false)

  const toggle = () => {
    const audio = audioRef.current
    if (!audio || failed) return
    if (audio.paused) {
      audio.play().catch(() => setFailed(true))
    } else {
      audio.pause()
    }
  }

  const seek = (event) => {
    const audio = audioRef.current
    if (!audio || !total) return
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width))
    audio.currentTime = ratio * total
    setCurrent(audio.currentTime)
  }

  return (
    <div className={`wa-voice${mine ? ' is-mine' : ''}`}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const length = event.currentTarget.duration
          if (Number.isFinite(length) && length > 0) setTotal(length)
        }}
        onEnded={() => {
          setPlaying(false)
          setCurrent(0)
        }}
        onError={() => setFailed(true)}
      />
      <button
        type="button"
        className="wa-voice-play"
        onClick={toggle}
        disabled={failed}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path fill="currentColor" d="M7 5h4v14H7zM13 5h4v14h-4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path fill="currentColor" d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="wa-voice-track"
        onClick={seek}
        aria-label="Seek voice message"
      >
        <span
          className="wa-voice-fill"
          style={{ width: `${total ? Math.min(100, (current / total) * 100) : 0}%` }}
        />
      </button>
      <span className="wa-voice-time">
        {failed ? 'Unavailable' : `${spokenTime(current)} / ${spokenTime(total || duration)}`}
      </span>
    </div>
  )
}

// What a class leader owes back after opening a message: a class picture for
// an announcement, a screenshot for a broadcast.
const UPLOAD_COPY = {
  announcement: {
    pending: 'Class picture pending',
    button: 'Upload class picture',
    done: 'Picture uploaded',
  },
  broadcast: {
    pending: 'Screenshot pending',
    button: 'Upload screenshot',
    done: 'Screenshot uploaded',
  },
}

// The class leader's proof of receipt: once the message has been viewed, upload
// a class picture or a screenshot. The file is stored by the API and the bubble
// keeps showing whether the upload is still pending.
function ClassProof({ message, onUploaded }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const choose = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
      setError('Use a JPG, PNG, WEBP or GIF image.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const image = await pictureFromFile(file)
      if (message.announcementId) {
        // The admin desk's announcement keeps its class pictures on the
        // announcement itself, so the admin sheet shows them there.
        await api.uploadAnnouncementPhoto(message.announcementId, { images: [image] })
      } else if (message.type === 'broadcast') {
        await api.uploadClassScreenshot(message.id, { image })
      } else {
        await api.uploadClassPicture(message.id, { image })
      }
      onUploaded?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const copy = UPLOAD_COPY[message.type]
  if (!message.readAt || !copy) return null

  return (
    <div className="wa-class-pic">
      {message.uploadUrl ? (
        <>
          <span className="wa-class-pic-status is-done">
            {copy.done}
            {message.uploadAt ? ` · ${message.uploadAt} IST` : ''}
          </span>
          <a
            className="wa-class-pic-link"
            href={message.uploadUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open picture
          </a>
        </>
      ) : (
        <>
          <span className="wa-class-pic-status">{copy.pending}</span>
          <button
            type="button"
            className="wa-class-pic-btn"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'Uploading…' : copy.button}
          </button>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={choose}
      />
      {error ? <span className="wa-class-pic-error">{error}</span> : null}
    </div>
  )
}
