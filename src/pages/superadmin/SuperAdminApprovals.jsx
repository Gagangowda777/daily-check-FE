import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { routeHref } from '../../lib/router.js'
import { ExcelSheet } from '../../components/ExcelSheet.jsx'

const STATUS_TONE = {
  approved: 'is-approved',
  pending: 'is-pending-admin',
  rejected: 'is-alert',
}

const Stat = ({ label, value, note, accent, active, onClick }) => (
  <button
    type="button"
    className={`stat is-clickable sa-kpi-${accent}${active ? ' is-selected' : ''}`}
    aria-pressed={active}
    onClick={onClick}
  >
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
    {note ? <span className="stat-note">{note}</span> : null}
  </button>
)

export default function SuperAdminApprovals({ date, query = '', grade = 'ALL' }) {
  const [state, setState] = useState({ key: '', data: null })
  const [version, setVersion] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [focus, setFocus] = useState('')

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

  const data = state.key === key ? state.data : null
  const loading = !data

  const summary = data?.summary || {
    total: 0,
    withUploads: 0,
    awaitingTeacher: 0,
    ready: 0,
    approved: 0,
    ncDeducted: 0,
  }
  const matchesFocus = (row) => {
    if (focus === 'ready') return row.ready && row.finalStatus !== 'approved'
    if (focus === 'awaiting') {
      return row.rowCount > 0 && !row.teacherAcknowledged && row.finalStatus !== 'approved'
    }
    if (focus === 'approved') return row.finalStatus === 'approved'
    if (focus === 'nc') return (row.ncDeducted || 0) > 0
    return true
  }

  const text = query.trim().toLowerCase()
  const sections = (data?.sections || []).filter((row) => {
    if (grade !== 'ALL' && row.grade !== grade) return false
    if (!matchesFocus(row)) return false
    if (!text) return true
    return (
      row.label.toLowerCase().includes(text) ||
      String(row.teacher || '').toLowerCase().includes(text)
    )
  })
  const readyToApprove = sections.filter(
    (row) => row.ready && row.finalStatus !== 'approved'
  ).length

  const approveAll = async () => {
    const targets = sections.filter((row) => row.ready && row.finalStatus !== 'approved')
    if (targets.length === 0) return

    setBulkBusy(true)
    setError('')
    setNotice('')
    let approved = 0
    const failures = []

    for (const row of targets) {
      try {
        await api.superAdminApprove({
          date,
          grade: row.grade,
          section: row.section,
          deductNc: false,
          deductCount: 0,
          note: 'Bulk approval',
        })
        approved += 1
      } catch (err) {
        failures.push(`${row.label}: ${err.message}`)
      }
    }

    setBulkBusy(false)
    setNotice(
      `${approved} section${approved === 1 ? '' : 's'} approved for ${date}` +
        (failures.length ? `, ${failures.length} skipped.` : '.')
    )
    if (failures.length) setError(failures.join('; '))
    setVersion((value) => value + 1)
  }

  return (
    <div className="sa-wrap">
      {notice ? (
        <p className="action-notice" role="status">
          {notice}
        </p>
      ) : null}
      {error ? <div className="banner">{error}</div> : null}

      <div className="stat-grid">
        <Stat
          label="Ready for approval"
          value={loading ? '—' : summary.ready}
          note="teacher acknowledged"
          accent="ready"
          active={focus === 'ready'}
          onClick={() => setFocus(focus === 'ready' ? '' : 'ready')}
        />
        <Stat
          label="Awaiting teacher"
          value={loading ? '—' : summary.awaitingTeacher}
          note="not acknowledged yet"
          accent="awaiting"
          active={focus === 'awaiting'}
          onClick={() => setFocus(focus === 'awaiting' ? '' : 'awaiting')}
        />
        <Stat
          label="Approved today"
          value={loading ? '—' : summary.approved}
          note={`${summary.withUploads} section(s) uploaded`}
          accent="approved"
          active={focus === 'approved'}
          onClick={() => setFocus(focus === 'approved' ? '' : 'approved')}
        />
        <Stat
          label="NCs deducted"
          value={loading ? '—' : summary.ncDeducted}
          note="on final approval"
          accent="nc"
          active={focus === 'nc'}
          onClick={() => setFocus(focus === 'nc' ? '' : 'nc')}
        />
      </div>

      <ExcelSheet
        toolbar={
          <>
          {focus ? (
            <button type="button" className="tap is-quiet" onClick={() => setFocus('')}>
              Clear filter
            </button>
          ) : null}
          <button
            type="button"
            className="tap is-good sa-approve-all"
            disabled={readyToApprove === 0 || bulkBusy}
            title={
              readyToApprove
                ? `Approve all ${readyToApprove} ready section(s)`
                : 'No section has been acknowledged by its teacher yet'
            }
            onClick={approveAll}
          >
            {bulkBusy ? 'Approving…' : `Approve all ready (${readyToApprove})`}
          </button>
          </>
        }
        columns={[
          'Sl. no.',
          'Section',
          'Admin rows',
          'Teacher acknowledged',
          'NCs',
          'Final status',
          'Actions',
        ]}
      >
        {loading ? (
          <tr>
            <td className="xls-empty" colSpan={7}>
              Loading the day’s uploads…
            </td>
          </tr>
        ) : sections.length === 0 ? (
          <tr>
            <td className="xls-empty" colSpan={7}>
              {text || grade !== 'ALL' || focus
                ? 'No section matches this search, grade or card filter.'
                : 'No sections found for this date.'}
            </td>
          </tr>
        ) : (
          sections.map((row, index) => (
            <tr
              key={row.label}
              className={`xls-row${
                row.rowCount > 0 && !row.teacherAcknowledged ? ' is-muted' : ''
              }${row.ready && row.finalStatus !== 'approved' ? ' is-ready' : ''}`}
            >
              <td className="xls-no">{index + 1}</td>
              <td className="xls-route">{row.label}</td>
              <td>
                {row.rowCount === 0 ? (
                  <span className="xls-count">nothing uploaded</span>
                ) : (
                  <span className="xls-time">{row.rowCount}</span>
                )}
              </td>
              <td>
                {row.teacherAcknowledged ? (
                  <span className="xls-badge is-ack">yes · {row.acknowledgedAt}</span>
                ) : (
                  <span className="xls-badge is-neutral">not yet</span>
                )}
                <span className="xls-sub-text">
                  {row.acknowledgedBy
                    ? `by ${row.acknowledgedBy}`
                    : row.teacher
                      ? `class teacher: ${row.teacher}`
                      : 'no class teacher on record'}
                </span>
              </td>
              <td>
                <span className="xls-count">
                  {row.ncCount === null ? '—' : `${row.ncCount} NC`}
                  {row.ncStudents.length ? ` · ${row.ncStudents.length} student(s)` : ''}
                </span>
              </td>
              <td>
                <span className={`xls-badge ${STATUS_TONE[row.finalStatus] || ''}`.trim()}>
                  {row.finalStatus === 'pending' ? 'pending admin' : row.finalStatus}
                </span>
                {row.finalStatus === 'approved' ? (
                  <span className="xls-sub-text">
                    {row.finalAt} · {row.finalBy}
                    {row.ncDeducted ? ` · ${row.ncDeducted} NC deducted` : ''}
                  </span>
                ) : null}
              </td>
              <td className="xls-actions">
                {row.finalStatus === 'approved' ? (
                  <span className="xls-count">signed off</span>
                ) : (
                  <a
                    className={`tap${row.ready ? ' sa-review-link' : ''}`}
                    href={routeHref(`superadmin/review/${row.grade}/${row.section}/${date}`)}
                    aria-disabled={row.rowCount === 0}
                    onClick={(event) => {
                      if (row.rowCount === 0) event.preventDefault()
                    }}
                  >
                    Review
                  </a>
                )}
              </td>
            </tr>
          ))
        )}
      </ExcelSheet>
    </div>
  )
}
