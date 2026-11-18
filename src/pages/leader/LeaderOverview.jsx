import { useState } from 'react'
import { api } from '../../lib/api.js'
import { routeHref } from '../../lib/router.js'

const NOTE_KINDS = [
  { id: 'attendance', label: 'Attendance' },
  { id: 'exit', label: 'Exit' },
  { id: 'general', label: 'General' },
]

const KIND_LABEL = {
  attendance: 'Attendance',
  exit: 'Exit',
  general: 'General',
}

const Stat = ({ label, value, note, tone }) => (
  <div className={`stat${tone ? ` is-${tone}` : ''}`}>
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
    {note ? <span className="stat-note">{note}</span> : null}
  </div>
)

export default function LeaderOverview({ data, grade, section, onChanged }) {
  const [kind, setKind] = useState('general')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const { stats } = data
  const tasks = [
    stats.unread
      ? { href: routeHref('leader/inbox'), text: `${stats.unread} message(s) to read`, tone: 'alert' }
      : null,
    stats.exitOpen
      ? { href: routeHref('leader/exit'), text: `${stats.exitOpen} exit restriction(s) still open`, tone: 'alert' }
      : null,
    stats.entryPending
      ? { href: routeHref('leader/entry'), text: `${stats.entryPending} entry check(s) with the class teacher`, tone: 'warn' }
      : null,
    data.nc.updatedInNe ? null : { href: routeHref('leader/nc'), text: 'NC count not updated in NE yet', tone: 'warn' },
    data.check.submittedAt
      ? null
      : { href: routeHref('leader/nc'), text: 'Daily check not closed by the teacher yet', tone: 'warn' },
  ].filter(Boolean)

  const send = async (event) => {
    event.preventDefault()
    if (body.trim().length < 3) {
      setError('Write a short note for the class teacher.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.leaderNoteSend({ grade, section, kind, body: body.trim() })
      setBody('')
      setNotice('Note sent to the class teacher.')
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="stat-grid">
        <Stat
          label="Present"
          value={stats.present}
          note={`of ${stats.roster} on the roster`}
          tone={stats.present === stats.roster ? 'ok' : undefined}
        />
        <Stat
          label="Absent"
          value={stats.absent}
          note={stats.late ? `${stats.late} late` : 'no late marks'}
          tone={stats.absent ? 'alert' : 'ok'}
        />
        <Stat
          label="Late buses"
          value={stats.busLate}
          note={stats.busLate ? 'students affected' : 'all on time'}
          tone={stats.busLate ? 'alert' : 'ok'}
        />
        <Stat
          label="Exit open"
          value={stats.exitOpen}
          note={`${stats.exitTotal} flagged today`}
          tone={stats.exitOpen ? 'alert' : 'ok'}
        />
        <Stat
          label="Entry checks"
          value={stats.entryPending}
          note={stats.entryPending ? 'with the teacher' : 'all clear'}
          tone={stats.entryPending ? 'warn' : 'ok'}
        />
        <Stat
          label="Unread messages"
          value={stats.unread}
          note={`${stats.messages} in today’s inbox`}
          tone={stats.unread ? 'alert' : 'ok'}
        />
      </div>

      <div className="leader-columns">
        <section className="t-card">
          <div className="t-card-head">
            <h2>What needs you</h2>
            <span className={`t-count${tasks.length ? ' is-alert' : ' is-ok'}`}>
              {tasks.length ? `${tasks.length} item(s)` : 'all clear'}
            </span>
          </div>
          <div className="t-body">
            {tasks.length === 0 ? (
              <p className="muted">
                Nothing pending. Your section has read everything and the check is closed.
              </p>
            ) : (
              <ul className="task-list">
                {tasks.map((task) => (
                  <li key={task.text} className={`task-item is-${task.tone}`}>
                    <span className="task-dot" aria-hidden="true" />
                    <a className="check-link" href={task.href}>
                      {task.text}
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <dl className="mini-facts">
              <div>
                <dt>Class teacher</dt>
                <dd>{data.teacher}</dd>
              </div>
              <div>
                <dt>Bus cut-off</dt>
                <dd>{data.cutoff}</dd>
              </div>
              <div>
                <dt>Daily check</dt>
                <dd>{data.check.submittedAt ? `closed ${data.check.submittedAt}` : 'open'}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="t-card">
          <div className="t-card-head">
            <h2>Report to the class teacher</h2>
            <span className="t-count">{data.notes.length} today</span>
          </div>
          <div className="t-body">
            <form className="note-form" onSubmit={send}>
              <div className="t-actions">
                {NOTE_KINDS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`tap${kind === option.id ? '' : ' is-quiet'}`}
                    onClick={() => setKind(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <textarea
                className="form-input textarea"
                rows="3"
                maxLength="600"
                placeholder="E.g. 3 students absent in the first hour, 25A201 has an exit slip pending."
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
              {error ? <div className="banner">{error}</div> : null}
              {notice ? <p className="action-notice">{notice}</p> : null}
              <button type="submit" className="action-button" disabled={busy}>
                {busy ? 'Sending…' : 'Send note'}
              </button>
            </form>

            {data.notes.length > 0 ? (
              <div className="note-list">
                {data.notes.map((note) => (
                  <article key={note.id} className={`note${note.readAt ? ' is-read' : ''}`}>
                    <div className="note-head">
                      <span className={`note-kind kind-${note.kind}`}>
                        {KIND_LABEL[note.kind] || 'Note'}
                      </span>
                      <span className="note-time">{note.sentAtIst || note.sentAt} IST</span>
                    </div>
                    <p className="note-body">{note.body}</p>
                    <div className="note-foot">
                      <span className="muted">
                        {note.readAt ? `read by ${note.readBy || 'the teacher'} at ${note.readAt}` : 'not read yet'}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">No notes sent today.</p>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
