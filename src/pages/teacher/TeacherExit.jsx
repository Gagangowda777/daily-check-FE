import { Fragment, useState } from 'react'
import { api } from '../../lib/api.js'
import { ExcelSheet } from '../../components/ExcelSheet.jsx'

export default function TeacherExit({ data, grade, section, date, busy, run }) {
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

  const submit = async (rollNo, mode) => {
    const id = `exit-${rollNo}-${mode}`
    const call =
      mode === 'absent'
        ? () => api.teacherExit(rollNo, 'absent', { grade, section, date, reason: value })
        : mode === 'excuse'
          ? () => api.teacherExit(rollNo, 'excuse', { grade, section, date, approver: value })
          : () => api.teacherExit(rollNo, 'resolve', { grade, section, date, note: value })
    const notice =
      mode === 'absent' ? 'Marked absent.' : mode === 'excuse' ? 'Excused.' : 'Restriction resolved.'
    const ok = await run(id, call, notice)
    // Keep the form (and what was typed) when the server rejects the change.
    if (ok) closeForm()
  }

  const exitPending = data.exit.filter((row) => ['pending', 'acknowledged'].includes(row.status))

  return (
    <ExcelSheet
      title="Exit restrictions"
      meta={`${data.exit.length} flagged · ${exitPending.length} open`}
      note="Acknowledge, excuse or resolve each student. Acknowledged rows still count as open."
      columns={['Sl. no.', 'Roll no', 'Student', 'Reason', 'Actions']}
    >
      {data.exit.length === 0 ? (
        <tr>
          <td className="xls-empty" colSpan={5}>
            Nobody restricted from exiting today.
          </td>
        </tr>
      ) : (
        data.exit.map((row, index) => {
          const rowBusy = busy.startsWith(`exit-${row.rollNo}`)
          const resolved = row.status === 'resolved'

          return (
            <Fragment key={row.rollNo}>
              <tr className="xls-row">
                <td className="xls-no">{index + 1}</td>
                <td className="xls-time">{row.rollNo}</td>
                <td>
                  <span className="xls-name">{row.name}</span>
                  {row.repeatResolutions >= 2 ? (
                    <span className="xls-sub-text">{row.repeatResolutions}× repeat</span>
                  ) : null}
                </td>
                <td>
                  {row.reason}
                  {row.note ? <span className="xls-sub-text">{row.note}</span> : null}
                </td>
                <td className="xls-actions">
                  <div className="t-actions">
                    <button
                      type="button"
                      className="tap"
                      disabled={rowBusy || row.status !== 'pending'}
                      title={
                        row.status !== 'pending' ? 'Already acknowledged' : 'Acknowledge this restriction'
                      }
                      onClick={() =>
                        run(
                          `exit-${row.rollNo}-acknowledge`,
                          () => api.teacherExit(row.rollNo, 'acknowledge', { grade, section, date }),
                          'Acknowledged.'
                        )
                      }
                    >
                      Acknowledge
                    </button>
                    <button
                      type="button"
                      className="tap is-quiet"
                      disabled={rowBusy || resolved}
                      onClick={() => openForm(row.rollNo, 'absent')}
                    >
                      Absent
                    </button>
                    <button
                      type="button"
                      className="tap is-quiet"
                      disabled={rowBusy || resolved}
                      onClick={() => openForm(row.rollNo, 'excuse')}
                    >
                      Excused
                    </button>
                    <button
                      type="button"
                      className="tap is-good"
                      disabled={row.status !== 'acknowledged'}
                      title={
                        row.status !== 'acknowledged'
                          ? 'Acknowledge before resolving'
                          : 'Resolve with a note'
                      }
                      onClick={() => openForm(row.rollNo, 'resolve')}
                    >
                      Resolved
                    </button>
                  </div>
                </td>
              </tr>

              {form?.rollNo === row.rollNo ? (
                <tr className="xls-sub">
                  <td colSpan={5}>
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
                  </td>
                </tr>
              ) : null}
            </Fragment>
          )
        })
      )}
    </ExcelSheet>
  )
}
