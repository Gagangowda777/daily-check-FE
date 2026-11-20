import { useState } from 'react'
import { api } from '../../lib/api.js'
import { ExcelSheet } from '../../components/ExcelSheet.jsx'
import { cap } from '../../lib/text.js'

const TONE = { present: 'is-ok', absent: 'is-pending', late: 'is-late' }

export default function TeacherAttendance({ data, grade, section, date, busy, run }) {
  const [ncFor, setNcFor] = useState(null)
  const [ncReason, setNcReason] = useState('')
  const [ncQty, setNcQty] = useState('1')
  const [localError, setLocalError] = useState('')

  const rows = data.attendance?.rows || []
  const summary = data.attendance?.summary || { present: 0, absent: 0, late: 0, nc: 0 }

  const mark = (rollNo, status, nc = null) => {
    setLocalError('')
    const action =
      status === 'late' && nc
        ? () =>
            api.teacherAttendance(rollNo, {
              grade,
              section,
              date,
              status,
              nc: true,
              ncReason: nc.reason,
              ncCount: nc.count,
            })
        : () => api.teacherAttendance(rollNo, { grade, section, date, status })
    const notice =
      status === 'late' && nc
        ? `Marked late with ${nc.count} NC${nc.count === 1 ? '' : 's'}.`
        : status === 'absent'
          ? 'Marked absent. This carries to tomorrow until you mark present.'
          : status === 'late'
            ? 'Marked late.'
            : 'Marked present.'
    return run(`att-${rollNo}`, action, notice)
  }

  const openNc = (rollNo) => {
    setNcFor(rollNo)
    setNcReason('')
    setNcQty('1')
    setLocalError('')
  }

  const saveNc = async (rollNo) => {
    if (!ncReason.trim()) {
      setLocalError('Give a short reason for the NC.')
      return
    }
    const count = Math.round(Number(ncQty))
    if (!Number.isFinite(count) || count < 1 || count > 99) {
      setLocalError('Enter between 1 and 99 NCs for this student.')
      return
    }
    const ok = await mark(rollNo, 'late', { reason: ncReason.trim(), count })
    if (ok) {
      setNcFor(null)
      setNcReason('')
      setNcQty('1')
    }
  }

  return (
    <ExcelSheet
      title="Class attendance"
      meta={`${summary.present} present · ${summary.absent} absent · ${summary.late} late`}
      note="Absence continues every following day until you mark the student present again. A delayed arrival can be marked with an NC."
      columns={['Sl. no.', 'Roll no', 'Student', 'Today', 'NC', 'Mark attendance']}
    >
      {rows.length === 0 ? (
        <tr>
          <td className="xls-empty" colSpan={6}>
            This section has no roster rows for today.
          </td>
        </tr>
      ) : (
        rows.map((row, index) => {
          const rowBusy = busy === `att-${row.rollNo}`
          return (
            <tr key={row.rollNo} className="xls-row">
              <td className="xls-no">{index + 1}</td>
              <td className="xls-time">{row.rollNo}</td>
              <td className="xls-name">{row.name}</td>
              <td>
                <span className={`xls-badge ${TONE[row.attendance] || ''}`.trim()}>
                  {cap(row.attendance)}
                </span>
              </td>
              <td>
                {row.ncFlag ? (
                  <span className="xls-sub-text">
                    NC × {row.ncCount || 1} · {cap(row.ncReason || 'delayed')}
                  </span>
                ) : (
                  <span className="xls-count">-</span>
                )}
              </td>
              <td className="xls-actions">
                <div className="t-actions">
                  <button
                    type="button"
                    className={`tap${row.attendance === 'present' ? '' : ' is-quiet'}`}
                    disabled={rowBusy}
                    onClick={() => mark(row.rollNo, 'present')}
                  >
                    Present
                  </button>
                  <button
                    type="button"
                    className={`tap${row.attendance === 'absent' ? ' is-danger' : ' is-quiet'}`}
                    disabled={rowBusy}
                    onClick={() => mark(row.rollNo, 'absent')}
                  >
                    Absent
                  </button>
                  <button
                    type="button"
                    className={`tap${row.attendance === 'late' && !row.ncFlag ? '' : ' is-quiet'}`}
                    disabled={rowBusy}
                    onClick={() => mark(row.rollNo, 'late')}
                  >
                    Late
                  </button>
                  <button
                    type="button"
                    className={`tap${row.ncFlag ? ' is-danger' : ' is-quiet'}`}
                    disabled={rowBusy}
                    title="Late arrival with an NC"
                    onClick={() => openNc(row.rollNo)}
                  >
                    Late + NC
                  </button>
                </div>
              </td>
            </tr>
          )
        })
      )}

      {localError ? (
        <tr>
          <td className="xls-empty" colSpan={6}>
            {localError}
          </td>
        </tr>
      ) : null}

      {ncFor ? (
        <tr className="xls-sub">
          <td colSpan={6}>
            <div className="t-inline">
              <span className="t-row-sub">NC for {ncFor}</span>
              <input
                className="form-input nc-input"
                type="number"
                min="1"
                max="99"
                step="1"
                aria-label="Number of NCs"
                title="Number of NCs"
                value={ncQty}
                onChange={(event) => setNcQty(event.target.value)}
              />
              <input
                className="form-input"
                value={ncReason}
                placeholder="Reason for the NC, e.g. late by 20 minutes without note"
                onChange={(event) => setNcReason(event.target.value)}
              />
              <button
                type="button"
                className="tap"
                disabled={busy === `att-${ncFor}`}
                onClick={() => saveNc(ncFor)}
              >
                Save late + NC
              </button>
              <button type="button" className="tap is-quiet" onClick={() => setNcFor(null)}>
                Cancel
              </button>
            </div>
          </td>
        </tr>
      ) : null}
    </ExcelSheet>
  )
}
