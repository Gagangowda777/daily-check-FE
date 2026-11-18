import { useState } from 'react'

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

// Chat-style inbox: a list of conversations, and opening one shows that message
// on its own and marks it read. Used by every dashboard's inbox.
export default function ChatMessages({ items, loading, emptyText, onRead }) {
  const [openKey, setOpenKey] = useState(null)
  const open = items.find((item) => `${item.kind}-${item.id}` === openKey)

  if (loading) return <p className="msg-empty">Loading messages…</p>
  if (items.length === 0) return <p className="msg-empty">{emptyText}</p>

  if (open) {
    return (
      <div className="chat">
        <div className="chat-head">
          <button
            type="button"
            className="chat-back"
            onClick={() => setOpenKey(null)}
            aria-label="Back to inbox"
          >
            ←
          </button>
          <span className="chat-avatar">{initials(open.fromName)}</span>
          <div className="chat-head-text">
            <span className="chat-name">{open.fromName}</span>
            {open.fromContext ? <span className="chat-context">{open.fromContext}</span> : null}
          </div>
        </div>

        <div className="chat-bubbles">
          <article className="chat-bubble">
            {open.title ? <h3 className="chat-bubble-title">{open.title}</h3> : null}
            <p className="chat-bubble-body">{open.body}</p>
            <span className="chat-bubble-time">{open.sentAtIst || open.sentAt} IST</span>
          </article>
          <p className="chat-read">
            {open.readAt
              ? `Read${open.readBy ? ` by ${open.readBy}` : ''} at ${open.readAt} IST`
              : 'Opening this message marks it read.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <ul className="chat-list">
      {items.map((item) => {
        const key = `${item.kind}-${item.id}`
        const unread = !item.readAt
        return (
          <li key={key}>
            <button
              type="button"
              className={`chat-row${unread ? ' is-unread' : ''}`}
              onClick={() => {
                setOpenKey(key)
                if (unread) onRead?.(item)
              }}
            >
              <span className="chat-avatar">{initials(item.fromName)}</span>
              <span className="chat-main">
                <span className="chat-row-top">
                  <span className="chat-name">{item.fromName}</span>
                  <span className="chat-time">{item.sentAtIst || item.sentAt} IST</span>
                </span>
                <span className="chat-row-bottom">
                  <span className="chat-snippet">
                    {item.title ? <strong>{item.title}</strong> : null}
                    {item.title && item.body ? ' · ' : null}
                    {item.body}
                  </span>
                  {unread ? <span className="chat-dot" aria-label="Unread" /> : null}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
