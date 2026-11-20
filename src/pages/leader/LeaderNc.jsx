import { routeHref } from '../../lib/router.js'

const pendingBlocks = (data) => {
  const exitOpen = data.exit.filter((row) => ['pending', 'acknowledged'].includes(row.status))
  // Admin broadcasts also land in the inbox, so the message block specifically
  // needs a message the class teacher sent.
  const teacherMessages = data.stats.teacherMessages ?? data.stats.messages
  return [
    exitOpen.length
      ? { label: 'Exit restrictions', href: routeHref('leader/exit') }
      : null,
    data.entry.length ? { label: 'Entry checks', href: routeHref('leader/entry') } : null,
    data.nc.count !== null && data.nc.updatedInNe
      ? null
      : { label: 'NC tracker', href: routeHref('leader/nc') },
    teacherMessages ? null : { label: 'Class leader message', href: routeHref('leader/inbox') },
  ].filter(Boolean)
}

// NC tracker plus the daily-check state, mirrored from the teacher's side.
export default function LeaderNc({ data }) {
  const ncDone = data.nc.count !== null && data.nc.updatedInNe
  const blocks = pendingBlocks(data)
  const closed = Boolean(data.check.submittedAt)

  return (
    <>
      <div className="stat-grid">
        <div className={`stat${ncDone ? ' is-ok' : ' is-alert'}`}>
          <span className="stat-label">NC count</span>
          <span className="stat-value">{data.nc.count ?? '-'}</span>
          <span className="stat-note">{data.nc.updatedInNe ? 'Updated in NE' : 'Not updated in NE'}</span>
        </div>
        <div className={`stat${data.check.submittedAt ? ' is-ok' : ' is-warn'}`}>
          <span className="stat-label">Daily check</span>
          <span className="stat-value">{data.check.submittedAt || 'Open'}</span>
          <span className="stat-note">
            {data.check.submittedAt ? 'Closed by the class teacher' : 'Waiting for the class teacher'}
          </span>
        </div>
      </div>

      <section className="t-card">
        <div className="t-card-head">
          <h2>What is still blocking the close</h2>
          <span className={`t-count${!closed && blocks.length ? ' is-alert' : ' is-ok'}`}>
            {closed ? 'Closed' : blocks.length ? `${blocks.length} block(s)` : 'Ready to close'}
          </span>
        </div>
        <div className="t-body">
          {closed ? (
            <p className="muted">
              The class teacher closed today’s check at {data.check.submittedAt}. Nothing is left to
              close.
            </p>
          ) : blocks.length === 0 ? (
            <p className="muted">Every block is complete. The class teacher can close today’s check.</p>
          ) : (
            <ul className="task-list">
              {blocks.map((block) => (
                <li key={block.label} className="task-item is-warn">
                  <span className="task-dot" aria-hidden="true" />
                  <a className="check-link" href={block.href}>
                    {block.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="t-row-sub">
            The NC count and NE update are entered by the class teacher; the leader can track them
            here.
          </p>
        </div>
      </section>
    </>
  )
}
