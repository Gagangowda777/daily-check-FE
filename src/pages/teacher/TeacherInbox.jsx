import { useState } from 'react'
import { api } from '../../lib/api.js'
import MessageInbox from '../../components/MessageInbox.jsx'
import '../../components/inbox.css'

const TARGETS = [
  { id: 'LEADER', label: 'Class leader' },
  { id: 'ADMIN', label: 'Admin' },
  { id: 'ALL', label: 'All dashboards' },
]

// The class teacher's inbox: everything addressed to the section (admin
// broadcasts, leader notes, direct messages) plus a form to write back.
export default function TeacherInbox({ grade, section, onSent }) {
  const [target, setTarget] = useState('LEADER')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [version, setVersion] = useState(0)

  const send = async (event) => {
    event.preventDefault()
    if (body.trim().length < 3) {
      setError('Write the message you want to send.')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.sendInboxMessage({
        to: target,
        title: title.trim(),
        body: body.trim(),
        grade,
        section,
      })
      const label = TARGETS.find((item) => item.id === target)?.label || 'recipient'
      setTitle('')
      setBody('')
      setNotice(`Message sent to ${label.toLowerCase()}.`)
      setVersion((value) => value + 1)
      onSent?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="msg-card">
        <div className="msg-head">
          <h2>Send a message</h2>
          <span className="msg-count">times shown in IST</span>
        </div>
        <div className="msg-body">
          <form className="msg-compose" onSubmit={send}>
            <div>
              <span className="msg-label">To</span>
              <div className="msg-targets">
                {TARGETS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`msg-chip${target === item.id ? ' is-on' : ''}`}
                    aria-pressed={target === item.id}
                    onClick={() => {
                      setTarget(item.id)
                      setError('')
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <label>
              <span className="msg-label">Subject</span>
              <input
                className="msg-input"
                maxLength={120}
                placeholder="Optional subject"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label>
              <span className="msg-label">Message</span>
              <textarea
                className="msg-input"
                rows="4"
                maxLength={1000}
                placeholder="Write the message the recipient should see."
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>

            {target === 'LEADER' ? (
              <p className="msg-hint">
                Sending to the class leader also completes today’s class leader message block.
              </p>
            ) : null}

            {error ? <p className="msg-error">{error}</p> : null}
            {notice ? <p className="msg-note">{notice}</p> : null}

            <div className="msg-actions">
              <button type="submit" className="msg-send" disabled={busy}>
                {busy ? 'Sending…' : 'Send message'}
              </button>
            </div>
          </form>
        </div>
      </section>

      <MessageInbox
        title={`Inbox · ${grade === 'PU1' ? '11' : '12'}${section}`}
        emptyText="No messages from the admin or the class leader today."
        version={version}
      />
    </>
  )
}
