import { useState } from 'react'
import { api } from '../../lib/api.js'

export default function TeacherEntry({ data, grade, section, busy, run }) {
  const [handoverFor, setHandoverFor] = useState(null)
  const [note, setNote] = useState('')

  const entryLeft = data.entry.length

  const startHandover = (rollNo) => {
    setHandoverFor(rollNo)
    setNote('')
  }

  const sendHandover = (row) => {
    run(
      `entry-${row.rollNo}`,
      () => api.teacherEntry(row.rollNo, 'handover', { grade, section, note }),
      `${row.name} sent to the admin queue.`
    )
    setHandoverFor(null)
  }

  return (
    <section className="t-card">
      <div className="t-card-head">
        <h2>Entry restrictions</h2>
        <span className={`t-count${entryLeft ? ' is-alert' : ' is-ok'}`}>{entryLeft} to verify</span>
      </div>
      <div className="t-body">
        {entryLeft === 0 ? (
          <p className="muted">All entry checks closed for this section.</p>
        ) : (
          data.entry.map((row) => (
            <div key={row.rollNo} className="t-row">
              <div className="t-row-main">
                <strong>{row.name}</strong>
                <span className="t-row-sub">{row.rollNo}</span>
                {row.handover ? <span className="badge pending">handed over</span> : null}
              </div>

              <div className="t-actions">
                {row.subjects.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    className="subject-chip"
                    title={`Mark ${subject} cleared`}
                    disabled={busy === `entry-${row.rollNo}`}
                    onClick={() =>
                      run(
                        `entry-${row.rollNo}`,
                        () =>
                          api.teacherEntry(row.rollNo, 'submitted', {
                            grade,
                            section,
                            cleared: [subject],
                          }),
                        `${subject} cleared for ${row.name}.`
                      )
                    }
                  >
                    {subject}
                  </button>
                ))}
              </div>
              <span className="t-row-sub">Tap a subject to clear it, or submit all at once.</span>

              <div className="t-actions">
                <button
                  type="button"
                  className="tap is-good"
                  disabled={busy === `entry-${row.rollNo}`}
                  onClick={() =>
                    run(
                      `entry-${row.rollNo}`,
                      () =>
                        api.teacherEntry(row.rollNo, 'submitted', {
                          grade,
                          section,
                          cleared: row.subjects,
                        }),
                      `${row.name} submitted.`
                    )
                  }
                >
                  Submitted
                </button>
                <button
                  type="button"
                  className="tap is-quiet"
                  disabled={busy === `entry-${row.rollNo}`}
                  onClick={() =>
                    run(
                      `entry-${row.rollNo}`,
                      () => api.teacherEntry(row.rollNo, 'absent', { grade, section }),
                      `${row.name} marked absent.`
                    )
                  }
                >
                  Absent
                </button>
                <button type="button" className="tap" onClick={() => startHandover(row.rollNo)}>
                  Hand Over
                </button>
              </div>

              {handoverFor === row.rollNo ? (
                <div className="t-inline">
                  <input
                    className="form-input"
                    value={note}
                    placeholder="Note for administration (optional)"
                    onChange={(event) => setNote(event.target.value)}
                  />
                  <button
                    type="button"
                    className="tap"
                    disabled={busy === `entry-${row.rollNo}`}
                    onClick={() => sendHandover(row)}
                  >
                    Send
                  </button>
                  <button type="button" className="tap is-quiet" onClick={() => setHandoverFor(null)}>
                    Cancel
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
