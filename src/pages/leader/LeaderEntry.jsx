export default function LeaderEntry({ data }) {
  const handedOver = data.entry.filter((row) => row.handover)

  return (
    <section className="t-card">
      <div className="t-card-head">
        <h2>Entry checks</h2>
        <span className={`t-count${data.entry.length ? ' is-alert' : ' is-ok'}`}>
          {data.entry.length} pending
        </span>
      </div>
      <div className="t-body">
        <p className="t-row-sub">
          Entry restrictions stay open until the class teacher clears the subjects with the teacher
          concerned.
        </p>
        {data.entry.length === 0 ? (
          <p className="muted">All entry checks are closed for this section.</p>
        ) : (
          data.entry.map((row) => (
            <div key={row.rollNo} className="t-row">
              <div className="t-row-main">
                <strong>{row.name}</strong>
                <span className="t-row-sub">{row.rollNo}</span>
                {row.handover ? (
                  <span className="badge pending">sent to admin {row.handoverAt || ''}</span>
                ) : null}
              </div>
              <span className="t-row-sub">
                {row.subjects.length ? row.subjects.join(' · ') : 'No pending subjects recorded'}
              </span>
            </div>
          ))
        )}
        {handedOver.length > 0 ? (
          <p className="t-row-sub">{handedOver.length} student(s) handed over to administration.</p>
        ) : null}
      </div>
    </section>
  )
}
