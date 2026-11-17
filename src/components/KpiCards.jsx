import { useEffect, useState } from 'react'

const STATUS_ORDER = ['pending', 'acknowledged', 'absent', 'excused', 'resolved']

const classLabel = (row) => `${row.grade === 'PU1' ? '11' : '12'}${row.section}`

export default function KpiCards({ kpi }) {
  const [openCard, setOpenCard] = useState(null)

  useEffect(() => {
    if (!openCard) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setOpenCard(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openCard])

  if (!kpi) {
    return (
      <section className="kpi-grid" aria-label="Live counters">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="kpi is-loading">
            <span className="kpi-title">Loading…</span>
            <span className="kpi-value">—</span>
          </div>
        ))}
      </section>
    )
  }

  const { buses, exit, entry, messages } = kpi

  const cards = [
    {
      id: 'buses',
      title: 'Late buses',
      value: buses.lateRoutes,
      unit: `of ${buses.totalRoutes}`,
      alert: buses.alert,
      sub: `${buses.affectedStudents} students affected`,
      note: buses.notArrived.length
        ? `${buses.notArrived.length} not arrived past ${buses.secondCutoff}`
        : `All arrived by ${buses.secondCutoff}`,
    },
    {
      id: 'exit',
      title: 'Exit restrictions',
      value: exit.active,
      unit: 'active',
      sub: STATUS_ORDER.map((status) => `${status} ${exit[status]}`).join(' · '),
      note: `${exit.total} flagged today · ${exit.resolved} resolved`,
    },
    {
      id: 'entry',
      title: 'Entry restrictions',
      value: entry.total,
      unit: 'flagged',
      sub: `Hand-over queue ${entry.handoverQueue}`,
      note: `${entry.sectionsIncomplete} sections incomplete after ${entry.cutoff}`,
    },
    {
      id: 'messages',
      title: 'Class leader messages',
      value: messages.sent,
      unit: 'sent',
      sub: `${messages.overdue} overdue acknowledgements`,
      note: `${messages.windowMinutes}-minute acknowledgement window`,
    },
  ]

  const active = cards.find((card) => card.id === openCard)

  return (
    <>
      <section className="kpi-grid" aria-label="Live counters">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`kpi${card.alert ? ' is-alert' : ''}`}
            onClick={() => setOpenCard(card.id)}
            aria-expanded={openCard === card.id}
          >
            <span className="kpi-head">
              <span className="kpi-title">{card.title}</span>
              {card.alert ? <span className="kpi-alert">Alert</span> : null}
            </span>
            <span className="kpi-value">
              {card.value}
              <span className="kpi-unit">{card.unit}</span>
            </span>
            <span className="kpi-sub">{card.sub}</span>
            <span className="kpi-note">{card.note}</span>
          </button>
        ))}
      </section>

      {active ? (
        <div className="modal-overlay" role="presentation" onClick={() => setOpenCard(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${active.title} details`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h3>{active.title}</h3>
                <p className="modal-sub">
                  {kpi.date} · {active.value}
                  {active.unit}
                </p>
              </div>
              <button type="button" className="modal-close" onClick={() => setOpenCard(null)}>
                Close
              </button>
            </div>

            {openCard === 'buses' ? (
              <section className="modal-section">
                <h4>Routes</h4>
                <ul className="modal-list">
                  {buses.routes.map((route) => (
                    <li key={route.route}>
                      <span className="detail-route">{route.route}</span>
                      <span className={`badge ${route.late ? 'late' : 'present'}`}>
                        {route.late ? 'late' : 'on time'}
                      </span>
                      <span className="detail-time">
                        {route.arrivalTime || 'Not arrived'}
                      </span>
                      <span className="modal-date">{route.affectedStudents} students</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {openCard === 'exit' ? (
              <>
                <div className="modal-stats">
                  {STATUS_ORDER.map((status) => (
                    <div key={status} className="modal-stat">
                      <span className="modal-stat-value">{exit[status]}</span>
                      <span className="modal-stat-label">{status}</span>
                    </div>
                  ))}
                </div>
                <section className="modal-section">
                  <h4>Restricted students</h4>
                  <ul className="modal-list">
                    {exit.students.map((student) => (
                      <li key={student.rollNo}>
                        <span>{student.name}</span>
                        <span className={`badge ${student.resolutionStatus}`}>
                          {student.resolutionStatus}
                        </span>
                        <span className="modal-date">
                          {classLabel(student)} · {student.restrictionReason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            ) : null}

            {openCard === 'entry' ? (
              <>
                <div className="modal-stats">
                  <div className="modal-stat">
                    <span className="modal-stat-value">{entry.total}</span>
                    <span className="modal-stat-label">Flagged</span>
                  </div>
                  <div className="modal-stat">
                    <span className="modal-stat-value">{entry.handoverQueue}</span>
                    <span className="modal-stat-label">Hand-over queue</span>
                  </div>
                  <div className="modal-stat">
                    <span className="modal-stat-value">{entry.sectionsIncomplete}</span>
                    <span className="modal-stat-label">Sections late</span>
                  </div>
                </div>

                <section className="modal-section">
                  <h4>Sections incomplete after {entry.cutoff}</h4>
                  {entry.incompleteSections.length === 0 ? (
                    <p className="muted">All sections submitted on time.</p>
                  ) : (
                    <ul className="modal-list">
                      {entry.incompleteSections.map((section) => (
                        <li key={`${section.grade}-${section.section}`}>
                          <span>
                            {section.grade === 'PU1' ? '11' : '12'}
                            {section.section}
                          </span>
                          <span className="modal-date">
                            {section.submittedAt ? `submitted ${section.submittedAt}` : 'not submitted'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="modal-section">
                  <h4>Admin hand-over queue</h4>
                  {entry.students.filter((student) => student.handover).length === 0 ? (
                    <p className="muted">No students waiting on administration.</p>
                  ) : (
                    <ul className="modal-list">
                      {entry.students
                        .filter((student) => student.handover)
                        .map((student) => (
                          <li key={student.rollNo}>
                            <span>{student.name}</span>
                            <span className={`badge ${student.resolutionStatus}`}>
                              {student.resolutionStatus}
                            </span>
                            <span className="modal-date">
                              {classLabel(student)} · {student.restrictionReason}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </section>
              </>
            ) : null}

            {openCard === 'messages' ? (
              <section className="modal-section">
                <h4>Broadcasts</h4>
                <ul className="modal-list">
                  {messages.items.map((message) => (
                    <li key={`${message.grade}-${message.section}-${message.sentAt}`}>
                      <span>
                        {message.grade === 'PU1' ? '11' : '12'}
                        {message.section}
                      </span>
                      <span>{message.title}</span>
                      <span
                        className={`badge ${
                          message.overdue
                            ? 'pending'
                            : message.acknowledgedAt
                              ? 'resolved'
                              : 'late'
                        }`}
                      >
                        {message.overdue
                          ? 'overdue'
                          : message.acknowledgedAt
                            ? 'acked'
                            : 'awaiting'}
                      </span>
                      <span className="modal-date">
                        sent {message.sentAt} ·{' '}
                        {message.acknowledgedAt ? `ack ${message.acknowledgedAt}` : 'no ack'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
