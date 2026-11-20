import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { routeHref } from '../../lib/router.js'
import { ExcelSheet } from '../../components/ExcelSheet.jsx'

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
  const [form, setForm] = useState({ reduceQty: {}, note: '' })
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
      const reduceNcs = Object.entries(form.reduceQty)
        .map(([rollNo, count]) => ({ rollNo, count: Number(count) || 0 }))
        .filter((item) => item.count > 0)
      const res = await api.superAdminApprove({
        date,
        grade,
        section,
        reduceNcs,
        note: form.note,
      })
      setNotice(
        `${row.label} approved for ${prettyDate(date)}` +
          (res.ncReduced
            ? `, ${res.ncReduced} NC(s) reduced${
                res.ncCount === null || res.ncCount === undefined
                  ? ''
                  : `, NC count is now ${res.ncCount}`
              }.`
            : '.')
      )
      setForm({ reduceQty: {}, note: '' })
      setVersion((value) => value + 1)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const setReduceQty = (rollNo, max, value) => {
    const count = Math.max(0, Math.min(max, Math.floor(Number(value) || 0)))
    setForm((prev) => ({
      ...prev,
      reduceQty: { ...prev.reduceQty, [rollNo]: count },
    }))
  }

  const reduceTotal = Object.values(form.reduceQty).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0
  )

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
        columns={['Sl. no.', 'Type', 'Roll no', 'Student', 'Detail', 'Reduce NC']}
      >
        {row.adminRows.length === 0 ? (
          <tr>
            <td className="xls-empty" colSpan={6}>
              Nothing was uploaded for this section.
            </td>
          </tr>
        ) : (
          row.adminRows.map((item, index) => {
            const ncStudent = row.ncStudents.find((s) => s.rollNo === item.rollNo)
            const detailNcMatch = String(item.detail || '').match(/(?:crossed\s*(\d+)|(\d+))\s*nc/i)
            const detailNcCount = detailNcMatch ? Number(detailNcMatch[1] || detailNcMatch[2]) || 3 : (/nc/i.test(String(item.detail || '')) ? 3 : 0)
            const hasNc = Boolean(item.ncFlag || ncStudent || detailNcCount > 0)
            const max = Number(item.ncCount || ncStudent?.count || detailNcCount) || (hasNc ? 1 : 0)
            const reduced = form.reduceQty[item.rollNo] || 0

            return (
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
                <td className="xls-action-cell">
                  {hasNc ? (
                    approved ? (
                      <span className="xls-sub-text">
                        {row.ncReducedRollNos?.includes(item.rollNo) ? 'NC reduced' : `${max} NC(s)`}
                      </span>
                    ) : (
                      <div className="sa-table-nc-reduce">
                        <input
                          id={`table-reduce-${item.rollNo}`}
                          className="form-input sa-nc-qty"
                          type="number"
                          min="0"
                          max={max}
                          step="1"
                          aria-label={`Reduce NCs for ${item.name}`}
                          value={reduced}
                          onChange={(event) => setReduceQty(item.rollNo, max, event.target.value)}
                        />
                        <span className="t-row-sub">of {max}</span>
                      </div>
                    )
                  ) : (
                    <span className="xls-count">—</span>
                  )}
                </td>
              </tr>
            )
          })
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
              {row.ncDeducted ? ` · ${row.ncDeducted} NC(s) reduced` : ''}
              {row.ncReducedRollNos?.length ? ` (${row.ncReducedRollNos.join(', ')})` : ''}
              {row.finalNote ? ` · “${row.finalNote}”` : ''}
            </p>
          ) : (
            <>
              <div className="sa-nc-head">
                <h3>Students with an NC today</h3>
                <span className={`t-count${row.ncStudents.length ? ' is-alert' : ' is-ok'}`}>
                  {row.ncStudents.length ? `${row.ncStudents.length} Flagged` : 'None flagged'}
                </span>
              </div>

              {row.ncStudents.length === 0 ? (
                <p className="t-row-sub">
                  {row.ncCount
                    ? `The NC tracker shows ${row.ncCount} NC(s) for the section, but no student is individually flagged.`
                    : 'No student carries an NC today.'}
                </p>
              ) : (
                <>
                  <p className="t-row-sub">
                    Enter how many NCs to reduce for a student. The flag clears once
                    their count reaches zero.
                  </p>
                  <ul className="sa-nc-list">
                    {row.ncStudents.map((student) => {
                      const max = Number(student.count) || 1
                      const reduced = form.reduceQty[student.rollNo] || 0
                      return (
                        <li
                          key={student.rollNo}
                          className={`sa-nc-row${reduced ? ' is-reduced' : ''}`}
                        >
                          <div className="sa-nc-main">
                            <strong>{student.name}</strong>
                            <span className="t-row-sub">
                              {student.rollNo} · {student.reason} · {max} NC
                              {max === 1 ? '' : 's'}
                            </span>
                          </div>
                          <div className="sa-nc-reduce">
                            <label
                              className="t-row-sub"
                              htmlFor={`reduce-${student.rollNo}`}
                            >
                              Reduce
                            </label>
                            <input
                              id={`reduce-${student.rollNo}`}
                              className="form-input sa-nc-qty"
                              type="number"
                              min="0"
                              max={max}
                              step="1"
                              value={reduced}
                              onChange={(event) =>
                                setReduceQty(student.rollNo, max, event.target.value)
                              }
                            />
                            <span className="t-row-sub">of {max}</span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="t-row-sub">
                    NCs today: {row.ncCount ?? '—'} →{' '}
                    {row.ncCount === null
                      ? 'section count not recorded'
                      : `${Math.max(0, row.ncCount - reduceTotal)} after reducing ${reduceTotal}`}
                  </p>
                  {row.ncCount !== null && reduceTotal > row.ncCount ? (
                    <p className="t-row-sub is-alert">
                      Only {row.ncCount} NC(s) are recorded for the section.
                    </p>
                  ) : null}
                </>
              )}

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
                  disabled={!row.ready || busy || (row.ncCount !== null && reduceTotal > row.ncCount)}
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
