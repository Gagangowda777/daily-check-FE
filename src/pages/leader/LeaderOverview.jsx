import { routeHref } from '../../lib/router.js'

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

export default function LeaderOverview({ data }) {
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
  ].filter(Boolean)

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
          note={stats.late ? `${stats.late} late` : 'No late marks'}
          tone={stats.absent ? 'alert' : 'ok'}
        />
        <Stat
          label="Late buses"
          value={stats.busLate}
          note={stats.busLate ? 'Students affected' : 'All on time'}
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
          note={stats.entryPending ? 'With the teacher' : 'All clear'}
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
              {tasks.length ? `${tasks.length} item(s)` : 'All clear'}
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
                <dd>{data.check.submittedAt ? `Closed ${data.check.submittedAt}` : 'Open'}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="t-card">
          <div className="t-card-head">
            <h2>Notes sent today</h2>
            <span className="t-count">{data.notes.length} today</span>
          </div>
          <div className="t-body">
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
                        {note.readAt ? `Read by ${note.readBy || 'the teacher'} at ${note.readAt}` : 'Not read yet'}
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
