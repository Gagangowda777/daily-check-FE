import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import './inbox.css'

// Read-only inbox used by the desks that only receive messages (transport,
// gate and the admin overview). The API marks the rows read on open.
export default function MessageInbox({
  title = 'Inbox',
  emptyText = 'No messages yet.',
  version = 0,
}) {
  const [state, setState] = useState({ key: '', messages: [], unread: 0 })
  const [error, setError] = useState('')
  const key = `inbox:${version}`

  useEffect(() => {
    let alive = true
    api
      .inboxMessages({})
      .then((payload) => {
        if (!alive) return
        setState({ key, messages: payload.messages, unread: payload.unread })
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
    <section className="msg-card">
      <div className="msg-head">
        <h2>{title}</h2>
        <span className={`msg-count${state.unread ? ' is-new' : ''}`}>
          {loading
            ? 'Loading…'
            : state.unread
              ? `${state.unread} new`
              : `${state.messages.length} message${state.messages.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {error ? (
        <p className="msg-error" style={{ padding: '10px 14px' }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="msg-empty">Loading messages…</p>
      ) : state.messages.length === 0 ? (
        <p className="msg-empty">{emptyText}</p>
      ) : (
        <div className="msg-list">
          {state.messages.map((message) => (
            <article
              key={`${message.fromRole}-${message.id}`}
              className={`msg-item${message.readAt ? '' : ' is-unread'}`}
            >
              <div className="msg-top">
                <span className="msg-from">{message.fromName}</span>
                {message.fromContext ? (
                  <span className="msg-context">{message.fromContext}</span>
                ) : null}
                <span className="msg-time">
                  {message.sentAtIst || message.sentAt} IST
                </span>
              </div>
              <h3 className="msg-title">{message.title}</h3>
              <p className="msg-text">{message.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
