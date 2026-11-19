import { Fragment, useState } from 'react'
import { api } from '../../lib/api.js'
import { ExcelSheet } from '../../components/ExcelSheet.jsx'

export default function TeacherEntry({ data, grade, section, busy, run }) {
  const [handoverFor, setHandoverFor] = useState(null)
  const [note, setNote] = useState('')

  const entryLeft = data.entry.length

  const startHandover = (rollNo) => {
    setHandoverFor(rollNo)
    setNote('')
  }

  const sendHandover = async (row) => {
    const ok = await run(
      `entry-${row.rollNo}`,
      () => api.teacherEntry(row.rollNo, 'handover', { grade, section, note }),
      `${row.name} sent to the admin queue.`
    )
    // Keep the note on screen if the hand-over failed.
    if (ok) {
      setHandoverFor(null)
      setNote('')
    }
  }

  return (
    <ExcelSheet
      title="Entry restrictions"
      meta={`${entryLeft} to verify`}
      note="Clear each pending subject, mark the student absent, or hand the case over to administration."
      columns={['Sl. no.', 'Roll no', 'Student', 'Pending subjects', 'Status', 'Actions']}
    >
      {entryLeft === 0 ? (
        <tr>
          <td className="xls-empty" colSpan={6}>
            All entry checks closed for this section.
          </td>
        </tr>
      ) : (
        data.entry.map((row, index) => (
          <Fragment key={row.rollNo}>
            <tr className="xls-row">
              <td className="xls-no">{index + 1}</td>
              <td className="xls-time">{row.rollNo}</td>
              <td>
                <span className="xls-name">{row.name}</span>
                {row.note ? <span className="xls-sub-text">{row.note}</span> : null}
              </td>
              <td>
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
              </td>
              <td>
                <span className={`xls-badge ${row.handover ? 'is-late' : 'is-pending'}`}>
                  {row.handover ? 'Handed over' : 'Pending'}
                </span>
              </td>
              <td className="xls-actions">
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
                    Hand over
                  </button>
                </div>
              </td>
            </tr>

            {handoverFor === row.rollNo ? (
              <tr className="xls-sub">
                <td colSpan={6}>
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
                </td>
              </tr>
            ) : null}
          </Fragment>
        ))
      )}
    </ExcelSheet>
  )
}
