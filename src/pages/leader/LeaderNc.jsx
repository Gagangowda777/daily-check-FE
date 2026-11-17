import { routeHref } from '../../lib/router.js'

const pendingBlocks = (data) => {
  const exitOpen = data.exit.filter((row) => ['pending', 'acknowledged'].includes(row.status))
  return [
    exitOpen.length ? 'Exit restrictions' : null,
    data.entry.length ? 'Entry checks' : null,
    data.nc.count !== null && data.nc.updatedInNe ? null : 'NC tracker',
    data.stats.messages ? null : 'Class leader message',
  ].filter(Boolean)
}

// NC tracker plus the daily-check state, mirrored from the teacher's side.
export default function LeaderNc({ data }) {
  const ncDone = data.nc.count !== null && data.nc.updatedInNe
  const blocks = pendingBlocks(data)

  return (
    <>
      <div className="stat-grid">
        <div className={`stat${ncDone ? ' is-ok' : ' is-alert'}`}>
          <span className="stat-label">NC count</span>
          <span className="stat-value">{data.nc.count ?? '—'}</span>
          <span className="stat-note">{data.nc.updatedInNe ? 'updated in NE' : 'not updated in NE'}</span>
        </div>
        <div className={`stat${data.check.submittedAt ? ' is-ok' : ' is-warn'}`}>
          <span className="stat-label">Daily check</span>
          <span className="stat-value">{data.check.submittedAt || 'Open'}</span>
          <span className="stat-note">
            {data.check.submittedAt ? 'closed by the class teacher' : 'waiting for the class teacher'}
          </span>
        </div>
      </div>

      <section className="t-card">
        <div className="t-card-head">
          <h2>What is still blocking the close</h2>
          <span className={`t-count${blocks.length ? ' is-alert' : ' is-ok'}`}>
            {blocks.length ? `${blocks.length} block(s)` : 'ready to close'}
          </span>
        </div>
        <div className="t-body">
          {blocks.length === 0 ? (
            <p className="muted">Every block is complete. The class teacher can close today’s check.</p>
          ) : (
            <ul className="task-list">
              {blocks.map((label) => (
                <li key={label} className="task-item is-warn">
                  <span className="task-dot" aria-hidden="true" />
                  <a className="check-link" href={routeHref('leader/overview')}>
                    {label}
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
