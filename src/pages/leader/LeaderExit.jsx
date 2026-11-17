const EXIT_TONE = {
  pending: 'pending',
  acknowledged: 'late',
  absent: 'none',
  excused: 'late',
  resolved: 'present',
}

// The leader monitors exit restrictions; the class teacher performs the
// acknowledge/excuse/resolve actions.
export default function LeaderExit({ data }) {
  const open = data.exit.filter((row) => ['pending', 'acknowledged'].includes(row.status))

  return (
    <section className="t-card">
      <div className="t-card-head">
        <h2>Exit restrictions</h2>
        <span className={`t-count${open.length ? ' is-alert' : ' is-ok'}`}>
          {open.length} open
        </span>
      </div>
      <div className="t-body">
        {data.exit.length === 0 ? (
          <p className="muted">Nobody in this section is restricted from exiting today.</p>
        ) : (
          data.exit.map((row) => (
            <div key={row.rollNo} className="t-row">
              <div className="t-row-main">
                <strong>{row.name}</strong>
                <span className="t-row-sub">{row.rollNo}</span>
                <span className={`badge ${EXIT_TONE[row.status]}`}>{row.status}</span>
                {row.untilResolved ? <span className="badge pending">until resolved</span> : null}
              </div>
              <span className="t-row-sub">
                {row.reason} · {row.untilResolved ? 'no end date' : row.endDate || 'no end date'}
              </span>
              <span className="t-row-sub">
                {row.acknowledgedBy
                  ? `Acknowledged by ${row.acknowledgedBy} at ${row.acknowledgedAt}`
                  : 'Not acknowledged by the class teacher yet'}
                {row.note ? ` · ${row.note}` : ''}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
