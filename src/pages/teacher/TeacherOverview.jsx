import { api } from '../../lib/api.js'
import { routeHref } from '../../lib/router.js'

const CHECKS = [
  { id: 'nc', label: 'NC tracker', href: routeHref('teacher/nc') },
  // The close check waits on a message the teacher sends to the class leader,
  // not on simply opening the inbox.
  { id: 'message', label: 'Message to class leader', href: routeHref('teacher/inbox') },
]

const Stat = ({ label, value, note, tone }) => (
  <div className={`stat${tone ? ` is-${tone}` : ''}`}>
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
    {note ? <span className="stat-note">{note}</span> : null}
  </div>
)

export default function TeacherOverview({ data, grade, section, pendingBlocks, closed, busy, run }) {
  const done = (id) => !pendingBlocks.includes(id)
  const pendingLabels = CHECKS.filter((check) => pendingBlocks.includes(check.id)).map(
    (check) => check.label
  )

  return (
    <>
      <div className="stat-grid">
        <Stat
          label="Late buses"
          value={data.lateBuses.length}
          note={data.lateBuses.length ? 'Students affected' : 'None today'}
          tone={data.lateBuses.length ? 'alert' : 'ok'}
        />
        <Stat
          label="NC count"
          value={data.nc.count ?? '-'}
          note={data.nc.updatedInNe ? 'Updated in NE' : 'Not updated in NE'}
          tone={data.nc.updatedInNe ? 'ok' : 'alert'}
        />
      </div>

      <section className="t-card">
        <div className="t-card-head">
          <h2>Today’s check</h2>
          <span className={`t-count${closed ? ' is-ok' : pendingBlocks.length ? ' is-alert' : ' is-ok'}`}>
            {closed ? `closed at ${data.check.submittedAt}` : `${CHECKS.length - pendingBlocks.length}/${CHECKS.length} done`}
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
                  {done(check.id) ? 'Done' : 'To do'}
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
                <p className="t-row-sub">All required checks are done. You can close today’s check.</p>
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
    </>
  )
}
