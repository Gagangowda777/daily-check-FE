export default function LeaderBuses({ data }) {
  return (
    <section className="t-card">
      <div className="t-card-head">
        <h2>Late bus arrivals</h2>
        <span className={`t-count${data.lateBuses.length ? ' is-alert' : ' is-ok'}`}>
          {data.lateBuses.length}
        </span>
      </div>
      <div className="t-body">
        <p className="t-row-sub">
          Bus cut-off is {data.cutoff}. Students below arrived after the cut-off.
        </p>
        {data.lateBuses.length === 0 ? (
          <p className="muted">No late buses for this section.</p>
        ) : (
          data.lateBuses.map((row) => (
            <div key={row.rollNo} className="t-row">
              <div className="t-row-main">
                <strong>{row.name}</strong>
                <span className="t-row-sub">{row.rollNo}</span>
                <span className="minutes">
                  {row.minutesLate === null ? 'bus not arrived' : `${row.minutesLate} min late`}
                </span>
              </div>
              <span className="t-row-sub">
                Route {row.route} · arrived {row.arrivalTime || 'not yet'}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
