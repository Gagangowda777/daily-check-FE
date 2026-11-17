import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { routeHref } from '../../lib/router.js'

const CHECKS = [
  { id: 'exit', label: 'Exit restrictions', href: routeHref('teacher/exit') },
  { id: 'entry', label: 'Entry checks', href: routeHref('teacher/entry') },
  { id: 'nc', label: 'NC tracker', href: routeHref('teacher/nc') },
  { id: 'message', label: 'Class leader message', href: routeHref('teacher/message') },
]

const NOTE_KIND = {
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

export default function TeacherOverview({ data, grade, section, pendingBlocks, closed, busy, run }) {
  const [notes, setNotes] = useState({ key: '', rows: [], unread: 0 })
  const [noteError, setNoteError] = useState('')

  const key = `${grade}:${section}:${data.date}`
  const exitOpen = data.exit.filter((row) => ['pending', 'acknowledged'].includes(row.status))

  useEffect(() => {
    let alive = true
    api
      .teacherNotes({ grade, section })
      .then((payload) => {
        if (alive) setNotes({ key, rows: payload.notes, unread: payload.unread })
      })
      .catch((err) => {
        if (alive) setNoteError(err.message)
      })
    return () => {
      alive = false
    }
  }, [grade, section, key])

  const markRead = async (note) => {
    setNoteError('')
    try {
      await api.teacherNoteRead(note.id, { grade, section })
      setNotes((current) => ({
        ...current,
        unread: Math.max(0, current.unread - 1),
        rows: current.rows.map((row) =>
          row.id === note.id ? { ...row, readAt: 'now', readBy: data.teacher } : row
        ),
      }))
    } catch (err) {
      setNoteError(err.message)
    }
  }

  const done = (id) => !pendingBlocks.includes(id)
  const pendingLabels = CHECKS.filter((check) => pendingBlocks.includes(check.id)).map(
    (check) => check.label.toLowerCase()
  )

  return (
    <>
      <div className="stat-grid">
        <Stat
          label="Late buses"
          value={data.lateBuses.length}
          note={data.lateBuses.length ? 'students affected' : 'none today'}
          tone={data.lateBuses.length ? 'alert' : 'ok'}
        />
        <Stat
          label="Exit restrictions"
          value={exitOpen.length}
          note={`${data.exit.length} flagged today`}
          tone={exitOpen.length ? 'alert' : 'ok'}
        />
        <Stat
          label="Entry checks"
          value={data.entry.length}
          note={data.entry.length ? 'students to verify' : 'all closed'}
          tone={data.entry.length ? 'alert' : 'ok'}
        />
        <Stat
          label="NC count"
          value={data.nc.count ?? '—'}
          note={data.nc.updatedInNe ? 'updated in NE' : 'not updated in NE'}
          tone={data.nc.updatedInNe ? 'ok' : 'alert'}
        />
      </div>

      <section className="t-card">
        <div className="t-card-head">
          <h2>Today’s check</h2>
          <span className={`t-count${closed ? ' is-ok' : pendingBlocks.length ? ' is-alert' : ' is-ok'}`}>
            {closed ? `closed at ${data.check.submittedAt}` : `${4 - pendingBlocks.length}/4 done`}
          </span>
        </div>
        <div className="t-body">
          <ul className="check-list">
            {CHECKS.map((check) => (
              <li key={check.id} className={`check-item${done(check.id) ? ' is-done' : ''}`}>
                <span className={`check-dot${done(check.id) ? ' is-done' : ''}`} aria-hidden="true" />
                <a className="check-link" href={check.href}>
                  {check.label}
                </a>
                <span className={`badge ${done(check.id) ? 'resolved' : 'pending'}`}>
                  {done(check.id) ? 'done' : 'to do'}
                </span>
              </li>
            ))}
          </ul>

          {closed ? (
            <p className="action-notice" role="status">
              Daily check closed at {data.check.submittedAt}. Nothing else to submit today.
            </p>
          ) : (
            <>
              {pendingLabels.length > 0 ? (
                <p className="t-row-sub">
                  Finish {pendingLabels.join(', ')} before closing the day.
                </p>
              ) : (
                <p className="t-row-sub">All four blocks are done. You can close today’s check.</p>
              )}
              <button
                type="button"
                className="action-button close-check"
                disabled={pendingBlocks.length > 0 || busy === 'close'}
                onClick={() => run('close', () => api.teacherClose({ grade, section }), 'Daily check closed.')}
              >
                {busy === 'close' ? 'Closing…' : 'Complete daily check'}
              </button>
            </>
          )}
        </div>
      </section>

      <section className="t-card">
        <div className="t-card-head">
          <h2>Notes from the class leader</h2>
          <span className={`t-count${notes.unread ? ' is-alert' : notes.rows.length ? ' is-ok' : ''}`}>
            {notes.unread ? `${notes.unread} unread` : notes.rows.length ? 'all read' : 'none'}
          </span>
        </div>
        <div className="t-body">
          {noteError ? <div className="banner">{noteError}</div> : null}
          {notes.key !== key ? (
            <p className="muted">Loading notes…</p>
          ) : notes.rows.length === 0 ? (
            <p className="muted">The class leader has not sent any notes today.</p>
          ) : (
            notes.rows.map((note) => (
              <article key={note.id} className={`note${note.readAt ? ' is-read' : ''}`}>
                <div className="note-head">
                  <span className={`note-kind kind-${note.kind}`}>{NOTE_KIND[note.kind] || 'Note'}</span>
                  <span className="note-time">{note.sentAt}</span>
                </div>
                <p className="note-body">{note.body}</p>
                <div className="note-foot">
                  <span className="muted">
                    {note.author}
                    {note.readAt ? ` · read at ${note.readAt}` : ''}
                  </span>
                  {note.readAt ? null : (
                    <button type="button" className="tap is-quiet" onClick={() => markRead(note)}>
                      Mark read
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  )
}
