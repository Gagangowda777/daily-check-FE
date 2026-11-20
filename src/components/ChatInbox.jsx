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
  TRANSPORT: 'Transport In-charge',
  GATE: 'Gate / Security',
  ALL: 'Everyone',
}

const INBOX_ROLE = {
  admin: 'ADMIN',
  superadmin: 'SUPERADMIN',
  teacher: 'TEACHER',
  leader: 'LEADER',
}

const TARGETS = {
  admin: ['SUPERADMIN', 'TEACHER', 'LEADER', 'TRANSPORT', 'GATE', 'ALL'],
  superadmin: ['ADMIN', 'TEACHER', 'LEADER', 'ALL'],
  teacher: ['LEADER', 'ADMIN', 'ALL'],
  leader: ['TEACHER', 'ADMIN', 'ALL'],
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [picker, setPicker] = useState(false)

  const key = `${role}:${version}:${refresh}`

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
      const other = message.mine ? message.toRole || 'ALL' : message.fromRole || 'ADMIN'
      const peer = String(other).toUpperCase()
      // A broadcast reaches the sender too; show that copy under "Everyone".
      if (message.mine && peer === myRole) return 'ALL'
      return peer
    }

    const list = loading ? [] : state.messages
    const map = new Map()
    for (const message of list) {
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

  const markRead = async (thread) => {
    const unread = thread.items.filter((message) => !message.mine && !message.readAt)
    await Promise.all(
      unread.map((message) =>
        api.markInboxRead(message.id, { kind: message.kind }).catch(() => null)
      )
    )
    if (unread.length) setRefresh((value) => value + 1)
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
                        {richTextToPlain(thread.last?.body) || thread.last?.title || ''}
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
                <span>All messages · visible to this dashboard only</span>
              </div>
            </header>

            <div className="wa-body">
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
                        className={`wa-bubble${message.mine ? ' is-mine' : ''}`}
                      >
                        {message.title && message.title !== message.body ? (
                          <span className="wa-bubble-title">{message.title}</span>
                        ) : null}
                        <p
                          className="wa-bubble-text"
                          dangerouslySetInnerHTML={{ __html: sanitizeRich(message.body) }}
                        />
                        <span className="wa-bubble-meta">
                          {clock(message)}
                          {message.mine ? (message.readAt ? ' · read' : ' · sent') : ''}
                        </span>
                      </article>
                    ))}
                  </Fragment>
                ))
              )}
            </div>

            {targets.includes(active.key) ? (
              <form className="wa-compose" onSubmit={send}>
                <div className="wa-compose-main">
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
                  <div
                    ref={editorRef}
                    className="wa-input wa-editor"
                    contentEditable
                    role="textbox"
                    aria-multiline="true"
                    aria-label="Message"
                    data-placeholder="Type a message"
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
                </div>
                <button type="submit" className="wa-send" disabled={busy}>
                  {busy ? 'Sending…' : 'Send'}
                </button>
              </form>
            ) : (
              <p className="wa-readonly">You can read this conversation but not reply here.</p>
            )}

            {error ? <p className="wa-error">{error}</p> : null}
            {notice ? <p className="wa-notice">{notice}</p> : null}
          </>
        )}
      </section>
    </div>
  )
}
