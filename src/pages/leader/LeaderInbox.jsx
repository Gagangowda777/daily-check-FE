import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import '../../components/inbox.css'

const TYPE_LABEL = {
  update: 'Update',
  announcement: 'Announcement',
  'authorized-exit': 'Authorized Exit',
  broadcast: 'Broadcast',
}

const localIso = (value = new Date()) =>
  new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

const prettyDate = (iso) => {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export default function LeaderInbox({ grade, section, onChanged }) {
  const today = localIso()
  const [date, setDate] = useState(today)
  const [version, setVersion] = useState(0)
  const [state, setState] = useState({ key: '', data: null })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [compose, setCompose] = useState({ title: '', body: '' })
  const [composeBusy, setComposeBusy] = useState(false)
  const [composeNotice, setComposeNotice] = useState('')
  const [composeError, setComposeError] = useState('')

  const key = `${grade}:${section}:${date}:${version}`
  const data = state.data
  // Changing the date must not show the previous day's messages under the new
  // date heading while the new day loads.
  const loading = state.key !== key

  useEffect(() => {
    let alive = true
    api
      .inbox({ grade, section, date })
      .then((payload) => {
        if (!alive) return
        setState({ key, data: payload })
        setError('')
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [grade, section, date, key])

  const acknowledge = async (message) => {
    setBusy(message.id)
    setError('')
    try {
      await api.acknowledgeMessage(message.id, { grade, section })
      setVersion((value) => value + 1)
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const sendMessage = async (event) => {
    event.preventDefault()
    if (compose.body.trim().length < 3) {
      setComposeError('Write the message you want to send.')
      return
    }

    setComposeBusy(true)
    setComposeError('')
    setComposeNotice('')
    try {
      await api.sendInboxMessage({
        to: 'TEACHER',
        title: compose.title.trim(),
        body: compose.body.trim(),
        date: today,
        grade,
        section,
      })
      setCompose({ title: '', body: '' })
      setComposeNotice('Message sent to the class teacher.')
      setVersion((value) => value + 1)
      onChanged?.()
    } catch (err) {
      setComposeError(err.message)
    } finally {
      setComposeBusy(false)
    }
  }

  return (
    <div className="inbox-body">
      <section className="msg-card">
        <div className="msg-head">
          <h2>Message the class teacher</h2>
          <span className="msg-count">times shown in IST</span>
        </div>
        <div className="msg-body">
          <form className="msg-compose" onSubmit={sendMessage}>
            <label>
              <span className="msg-label">Subject</span>
              <input
                className="msg-input"
                maxLength={120}
                placeholder="Optional subject"
                value={compose.title}
                onChange={(event) =>
                  setCompose({ ...compose, title: event.target.value })
                }
              />
            </label>
            <label>
              <span className="msg-label">Message</span>
              <textarea
                className="msg-input"
                rows="3"
                maxLength={1000}
                placeholder="Write a note for your class teacher."
                value={compose.body}
                onChange={(event) =>
                  setCompose({ ...compose, body: event.target.value })
                }
              />
            </label>
            {composeError ? <p className="msg-error">{composeError}</p> : null}
            {composeNotice ? <p className="msg-note">{composeNotice}</p> : null}
            <div className="msg-actions">
              <button type="submit" className="msg-send" disabled={composeBusy}>
                {composeBusy ? 'Sending…' : 'Send to class teacher'}
              </button>
            </div>
          </form>
        </div>
      </section>

      <div className="inbox-dateline">
        <span className="inbox-date">{prettyDate(date)}</span>
        <input
          className="inbox-date-input"
          type="date"
          aria-label="Inbox date"
          value={date}
          max={today}
          onChange={(event) => {
            const next = event.target.value
            // Ignore a cleared field so the label can never become "Invalid Date".
            if (!next) return
            setDate(next > today ? today : next)
          }}
        />
        {date !== today ? (
          <button type="button" className="inbox-today" onClick={() => setDate(today)}>
            Today
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="banner" role="alert">
          {error}
        </div>
      ) : null}

      <div className="inbox-counters">
        <div className="inbox-counter is-unread">
          <strong>{!loading && data ? data.counts.unread : '—'}</strong>
          <span>Unread</span>
        </div>
        <div className="inbox-counter is-acked">
          <strong>{!loading && data ? data.counts.acknowledged : '—'}</strong>
          <span>Acknowledged</span>
        </div>
      </div>

      {loading ? <p className="inbox-empty">Loading messages…</p> : null}

      {!loading && data && data.messages.length === 0 ? (
        <p className="inbox-empty">No messages for {prettyDate(date)}.</p>
      ) : null}

      {(loading ? [] : data?.messages || []).map((message) => (
        <article
          key={message.id}
          className={`inbox-msg${message.status === 'acknowledged' ? ' is-acked' : ''}`}
        >
          <div className="inbox-msg-top">
            <span className={`type-badge type-${message.type}`}>
              {TYPE_LABEL[message.type] || message.type}
            </span>
            <span className="inbox-msg-time">
              {message.sentAtIst || message.sentAt} IST
            </span>
          </div>

          {message.title !== TYPE_LABEL[message.type] ? (
            <h2 className="inbox-msg-title">{message.title}</h2>
          ) : null}
          <p className="inbox-msg-sender">
            From {message.sender} · {message.typeLabel}
          </p>
          <p className="inbox-msg-body">{message.body}</p>

          {message.students.length > 0 ? (
            <p className="inbox-msg-exit">
              Exit approved · {message.students.join(', ')} · out at {message.exitTime || '—'}
            </p>
          ) : null}

          {message.status === 'unread' ? (
            date === today ? (
              <button
                type="button"
                className="ack-button"
                disabled={busy === message.id}
                onClick={() => acknowledge(message)}
              >
                {busy === message.id ? 'Acknowledging…' : 'Acknowledge'}
              </button>
            ) : (
              <p className="inbox-not-acked">
                Not acknowledged — this message can only be acknowledged on the day it was sent.
              </p>
            )
          ) : (
            <p className="inbox-acked">
              Acknowledged by {message.acknowledgedBy || 'class leader'} at {message.acknowledgedAt} · locked
            </p>
          )}
        </article>
      ))}
    </div>
  )
}
