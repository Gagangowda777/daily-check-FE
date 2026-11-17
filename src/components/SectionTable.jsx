import { useState } from 'react'

const ENTRY_LABELS = {
  complete: 'Complete',
  'in-progress': 'In progress',
  pending: 'Pending',
}

const ENTRY_TONE = {
  complete: 'present',
  'in-progress': 'late',
  pending: 'pending',
}

const ACK_LABELS = {
  yes: 'Yes',
  partial: 'Partial',
  no: 'No',
  'no-messages': 'No messages',
}

const ACK_TONE = {
  yes: 'present',
  partial: 'late',
  no: 'pending',
  'no-messages': 'none',
}

export default function SectionTable({ sections, loading }) {
  const [onlyFollowUp, setOnlyFollowUp] = useState(false)

  const rows = onlyFollowUp ? sections.filter((row) => row.needsFollowUp) : sections
  const followUpCount = sections.filter((row) => row.needsFollowUp).length

  return (
    <section className="table-card">
      <div className="table-head">
        <h2>Section progress</h2>
        <div className="table-tools">
          <span className="muted">
            {loading ? 'Loading…' : `${rows.length} sections · ${followUpCount} need follow-up`}
          </span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={onlyFollowUp}
              onChange={(event) => setOnlyFollowUp(event.target.checked)}
            />
            Not responded only
          </label>
        </div>
      </div>

      {!loading && rows.length === 0 ? (
        <p className="empty">
          All sections have responded — nothing waiting on a teacher.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="records section-records">
            <thead>
              <tr>
                <th>Section</th>
                <th>Class teacher</th>
                <th>Exit check</th>
                <th>Entry check</th>
                <th>Daily NC</th>
                <th>Leader ack</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.grade}${row.section}`} className={row.needsFollowUp ? 'row-flag' : undefined}>
                  <td className="mono section-cell">{row.label}</td>
                  <td className="student-name">{row.teacher}</td>

                  <td>
                    <span className="cell-stack">
                      <span className="cell-figures">
                        {row.exit.pending} pending · {row.exit.acknowledged} acked
                      </span>
                      <span className={`badge ${row.exit.done ? 'present' : 'pending'}`}>
                        {row.exit.done ? 'Done' : 'Not responded'}
                      </span>
                    </span>
                  </td>

                  <td>
                    <span className={`badge ${ENTRY_TONE[row.entry.status]}`}>
                      {ENTRY_LABELS[row.entry.status]}
                    </span>
                  </td>

                  <td>
                    <span className="cell-stack">
                      <span className="cell-figures">
                        {row.nc.count === null ? 'Not entered' : `${row.nc.count} NC`}
                      </span>
                      <span className={`badge ${row.nc.updatedInNe ? 'present' : 'pending'}`}>
                        NE {row.nc.updatedInNe ? 'Yes' : 'No'}
                      </span>
                    </span>
                  </td>

                  <td>
                    <span className={`badge ${ACK_TONE[row.leaderAck.status]}`}>
                      {ACK_LABELS[row.leaderAck.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
