import { useState } from 'react'
import { api } from '../../lib/api.js'

const EXIT_TONE = {
  pending: 'pending',
  acknowledged: 'late',
  absent: 'none',
  excused: 'late',
  resolved: 'present',
}

export default function TeacherExit({ data, grade, section, busy, run }) {
  const [form, setForm] = useState(null)
  const [value, setValue] = useState('')

  const openForm = (rollNo, mode) => {
    setForm({ rollNo, mode })
    setValue('')
  }

  const closeForm = () => {
    setForm(null)
    setValue('')
  }

  const submit = (rollNo, mode) => {
    const id = `exit-${rollNo}-${mode}`
    if (mode === 'absent') {
      run(id, () => api.teacherExit(rollNo, 'absent', { grade, section, reason: value }), 'Marked absent.')
    } else if (mode === 'excuse') {
      run(
        id,
        () => api.teacherExit(rollNo, 'excuse', { grade, section, approver: value }),
        'Excused.'
      )
    } else {
      run(
        id,
        () => api.teacherExit(rollNo, 'resolve', { grade, section, note: value }),
        'Restriction resolved.'
      )
    }
    closeForm()
  }

  const exitPending = data.exit.filter((row) => ['pending', 'acknowledged'].includes(row.status))

  return (
    <section className="t-card">
      <div className="t-card-head">
        <h2>Exit restrictions</h2>
        <span className={`t-count${exitPending.length ? ' is-alert' : ' is-ok'}`}>
          {exitPending.length} open
        </span>
      </div>
      <div className="t-body">
        {data.exit.length === 0 ? (
          <p className="muted">Nobody restricted from exiting today.</p>
        ) : (
          data.exit.map((row) => (
            <div key={row.rollNo} className="t-row">
              <div className="t-row-main">
                <strong>{row.name}</strong>
                <span className="t-row-sub">{row.rollNo}</span>
                <span className={`badge ${EXIT_TONE[row.status]}`}>{row.status}</span>
                {row.repeatResolutions >= 2 ? (
                  <span className="repeat-badge">{row.repeatResolutions}× repeat</span>
                ) : null}
              </div>
              <span className="t-row-sub">
                {row.reason} · {row.untilResolved ? 'until resolved' : row.endDate || 'no end date'}
                {row.acknowledgedBy ? ` · acked by ${row.acknowledgedBy} ${row.acknowledgedAt}` : ''}
              </span>

              <div className="t-actions">
                <button
                  type="button"
                  className="tap"
                  disabled={busy === `exit-${row.rollNo}` || row.status === 'resolved'}
                  onClick={() =>
                    run(
                      `exit-${row.rollNo}`,
                      () => api.teacherExit(row.rollNo, 'acknowledge', { grade, section }),
                      'Acknowledged.'
                    )
                  }
                >
                  Acknowledge
                </button>
                <button type="button" className="tap is-quiet" onClick={() => openForm(row.rollNo, 'absent')}>
                  Absent
                </button>
                <button type="button" className="tap is-quiet" onClick={() => openForm(row.rollNo, 'excuse')}>
                  Excused
                </button>
                <button
                  type="button"
                  className="tap is-good"
                  disabled={row.status !== 'acknowledged'}
                  title={row.status !== 'acknowledged' ? 'Acknowledge before resolving' : 'Resolve with a note'}
                  onClick={() => openForm(row.rollNo, 'resolve')}
                >
                  Resolved
                </button>
              </div>

              {form?.rollNo === row.rollNo ? (
                <div className="t-inline">
                  <input
                    className="form-input"
                    value={value}
                    placeholder={
                      form.mode === 'absent'
                        ? 'Reason for absence'
                        : form.mode === 'excuse'
                          ? 'Approved by'
                          : 'Short resolution note'
                    }
                    onChange={(event) => setValue(event.target.value)}
                  />
                  <button
                    type="button"
                    className="tap"
                    disabled={busy.startsWith(`exit-${row.rollNo}`)}
                    onClick={() => submit(row.rollNo, form.mode)}
                  >
                    Save
                  </button>
                  <button type="button" className="tap is-quiet" onClick={closeForm}>
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
