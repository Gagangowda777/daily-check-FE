import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { routeHref } from '../../lib/router.js'
import { ExcelSheet } from '../../components/ExcelSheet.jsx'
import { cap } from '../../lib/text.js'

const prettyDate = (iso) => String(iso || '').split('-').reverse().join('/')

const labelOf = (grade, section) => `${grade === 'PU1' ? '11' : '12'}${section}`

const Stat = ({ label, value, note, tone }) => (
  <div className={`stat${tone ? ` is-${tone}` : ''}`}>
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
    {note ? <span className="stat-note">{note}</span> : null}
  </div>
)

// One section's uploaded day, opened from the final-approval sheet. Everything
// the super admin needs to sign off sits on this single page.
export default function SuperAdminReview({ grade, section, date }) {
  const [state, setState] = useState({ key: '', data: null })
  const [version, setVersion] = useState(0)
  const [form, setForm] = useState({ deductNc: false, deductCount: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const key = `${date}:${version}`

  useEffect(() => {
    let alive = true
    api
      .superAdminToday({ date })
      .then((payload) => {
        if (!alive) return
        setState({ key, data: payload })
        setError('')
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [date, key])

  const payload = state.key === key ? state.data : null
  const loading = !payload
  const row = payload?.sections?.find(
    (item) => item.grade === grade && item.section === section
  )

  const approve = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await api.superAdminApprove({
        date,
        grade,
        section,
        deductNc: form.deductNc,
        deductCount: form.deductNc ? Number(form.deductCount) || 0 : 0,
        note: form.note,
      })
      setNotice(
        `${row.label} approved for ${prettyDate(date)}` +
          (res.ncDeducted
            ? `, ${res.ncDeducted} NC(s) deducted, NC count is now ${res.ncCount}.`
            : '.')
      )
      setForm({ deductNc: false, deductCount: '', note: '' })
      setVersion((value) => value + 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const back = routeHref('superadmin/approvals')

  if (loading) {
    return (
      <div className="sa-review">
        <a className="sa-back" href={back}>
          ← Final approval
        </a>
        <p className="empty">Loading the uploaded day…</p>
      </div>
    )
  }

  if (!row) {
    return (
      <div className="sa-review">
        <a className="sa-back" href={back}>
          ← Final approval
        </a>
        <div className="banner">That section has no uploads on {prettyDate(date)}.</div>
      </div>
    )
  }

  const approved = row.finalStatus === 'approved'

  return (
    <div className="sa-review">
      <a className="sa-back" href={back}>
        ← Final approval
      </a>

      {notice ? (
        <p className="action-notice" role="status">
          {notice}
        </p>
      ) : null}
      {error ? <div className="banner">{error}</div> : null}

      <div className="sa-review-head">
        <div>
          <h2>{labelOf(grade, section)} · Uploaded day</h2>
          <p className="t-row-sub">
            {prettyDate(date)} · {row.rowCount} row{row.rowCount === 1 ? '' : 's'} from the
            coordinator
            {row.teacherAcknowledged
              ? ` · acknowledged by ${row.acknowledgedBy || 'the class teacher'} at ${row.acknowledgedAt}`
              : ' · Not acknowledged by the class teacher yet'}
          </p>
        </div>
        <span className={`xls-badge ${approved ? 'is-ok' : 'is-pending'}`}>
          {approved ? 'Approved' : row.ready ? 'Ready to approve' : 'Waiting for teacher'}
        </span>
      </div>

      <div className="stat-grid">
        <Stat label="Admin rows" value={row.rowCount} note="Uploaded today" />
        <Stat
          label="Present"
          value={row.attendance.present}
          note={`of ${row.attendance.present + row.attendance.absent + row.attendance.late} on the register`}
          tone="ok"
        />
        <Stat
          label="Absent"
          value={row.attendance.absent}
          note={`${row.attendance.late} late`}
          tone={row.attendance.absent ? 'alert' : 'ok'}
        />
        <Stat
          label="NCs today"
          value={row.ncCount === null ? '-' : row.ncCount}
          note={
            row.ncStudents.length
              ? `${row.ncStudents.length} student(s) flagged`
              : row.ncCount
                ? 'From the NC tracker'
                : 'None recorded'
          }
          tone={row.ncCount ? 'warn' : 'ok'}
        />
      </div>

      <ExcelSheet
        title="Rows uploaded by the coordinator"
        meta={`${row.adminRows.length} row${row.adminRows.length === 1 ? '' : 's'}`}
        columns={['Sl. no.', 'Type', 'Roll no', 'Student', 'Detail', 'Status']}
      >
        {row.adminRows.length === 0 ? (
          <tr>
            <td className="xls-empty" colSpan={6}>
              Nothing was uploaded for this section.
            </td>
          </tr>
        ) : (
          row.adminRows.map((item, index) => (
            <tr key={`${item.type}-${item.rollNo}`} className="xls-row">
              <td className="xls-no">{index + 1}</td>
              <td>
                <span className={`xls-badge ${item.type === 'exit' ? 'is-late' : 'is-blue'}`}>
                  {item.type === 'exit' ? 'Exit' : 'Entry'}
                </span>
              </td>
              <td className="xls-time">{item.rollNo}</td>
              <td className="xls-name">{item.name}</td>
              <td>{item.detail}</td>
              <td>
                <span className="xls-count">{cap(item.status)}</span>
              </td>
            </tr>
          ))
        )}
      </ExcelSheet>

      <section className="t-card">
        <div className="t-card-head">
          <h2>Final approval</h2>
          <span className={`t-count${approved ? ' is-ok' : row.ready ? ' is-alert' : ''}`.trim()}>
            {approved ? 'Signed off' : row.ready ? 'Ready' : 'Waiting for teacher'}
          </span>
        </div>
        <div className="t-body">
          {approved ? (
            <p className="muted">
              Approved at {row.finalAt} by {row.finalBy}
              {row.ncDeducted ? ` · ${row.ncDeducted} NC(s) deducted` : ''}
              {row.finalNote ? ` · “${row.finalNote}”` : ''}
            </p>
          ) : (
            <>
              {row.ncCount > 0 ? (
                <div className="sa-approve">
                  <label className="sa-check">
                    <input
                      type="checkbox"
                      checked={form.deductNc}
                      onChange={(event) =>
                        setForm({ ...form, deductNc: event.target.checked })
                      }
                    />
                    Do you want to deduct the number of NCs?
                  </label>
                  {form.deductNc ? (
                    <span className="sa-deduct">
                      <input
                        className="form-input sa-count"
                        type="number"
                        min="1"
                        max={row.ncCount}
                        aria-label="NCs to deduct"
                        value={form.deductCount}
                        onChange={(event) =>
                          setForm({ ...form, deductCount: event.target.value })
                        }
                      />
                      <span className="xls-count">
                        of {row.ncCount} NCs today →{' '}
                        {Math.max(0, row.ncCount - (Number(form.deductCount) || 0))} left
                      </span>
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="t-row-sub">No NCs recorded for this section today.</p>
              )}

              {row.ncStudents.length ? (
                <p className="t-row-sub">
                  Marked with NC:{' '}
                  {row.ncStudents.map((student) => `${student.rollNo} ${student.name}`).join(', ')}
                </p>
              ) : null}

              <div className="sa-actions">
                <input
                  className="form-input sa-note"
                  value={form.note}
                  placeholder="Approval note (optional)"
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                />
                <button
                  type="button"
                  className="tap is-good"
                  disabled={!row.ready || busy}
                  title={
                    row.ready
                      ? 'Give final approval'
                      : 'Waiting for the class teacher to acknowledge the upload'
                  }
                  onClick={approve}
                >
                  {busy ? 'Approving…' : 'Give final approval'}
                </button>
              </div>

              {!row.ready ? (
                <p className="t-row-sub">
                  The class teacher has not announced and acknowledged this upload yet.
                </p>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
