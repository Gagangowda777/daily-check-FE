import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import ChatMessages from './ChatMessages.jsx'
import './inbox.css'

// Inbox used by every dashboard. Messages behave like a chat: the list stays
// unread until that particular message is opened.
export default function MessageInbox({
  title = 'Inbox',
  emptyText = 'No messages yet.',
  version = 0,
}) {
  const [state, setState] = useState({ key: '', messages: [] })
  const [error, setError] = useState('')
  const key = `inbox:${version}`

  useEffect(() => {
    let alive = true
    api
      .inboxMessages({})
      .then((payload) => {
        if (!alive) return
        setState({ key, messages: payload.messages })
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
  const unread = state.messages.filter((message) => !message.readAt).length

  const markRead = async (message) => {
    try {
      const res = await api.markInboxRead(message.id, { kind: message.kind })
      setState((prev) => ({
        ...prev,
        messages: prev.messages.map((row) =>
          row.id === message.id && row.kind === message.kind
            ? { ...row, readAt: res.readAt || row.readAt, readBy: res.readBy || row.readBy }
            : row
        ),
      }))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="msg-card">
      <div className="msg-head">
        <h2>{title}</h2>
        <span className={`msg-count${unread ? ' is-new' : ''}`}>
          {loading
            ? 'Loading…'
            : unread
              ? `${unread} unread`
              : `${state.messages.length} message${state.messages.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {error ? <p className="msg-error chat-error">{error}</p> : null}

      <ChatMessages
        items={state.messages}
        loading={loading}
        emptyText={emptyText}
        onRead={markRead}
      />
    </section>
  )
}
