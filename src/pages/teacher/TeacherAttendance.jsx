import { useState } from 'react'
import { api } from '../../lib/api.js'
import { ExcelSheet } from '../../components/ExcelSheet.jsx'
import { cap } from '../../lib/text.js'

const TONE = { present: 'is-ok', absent: 'is-pending', late: 'is-late' }

export default function TeacherAttendance({ data, grade, section, date, busy, run }) {
  const [ncFor, setNcFor] = useState(null)
  const [ncReason, setNcReason] = useState('')
  const [localError, setLocalError] = useState('')

  const rows = data.attendance?.rows || []
  const summary = data.attendance?.summary || { present: 0, absent: 0, late: 0, nc: 0 }

  const mark = (rollNo, status, ncReasonText) => {
    setLocalError('')
    const action =
      status === 'late' && ncReasonText
        ? () => api.teacherAttendance(rollNo, { grade, section, date, status, nc: true, ncReason: ncReasonText })
        : () => api.teacherAttendance(rollNo, { grade, section, date, status })
    const notice =
      status === 'late' && ncReasonText
        ? 'Marked late with NC.'
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
    setLocalError('')
  }

  const saveNc = async (rollNo) => {
    if (!ncReason.trim()) {
      setLocalError('Give a short reason for the NC.')
      return
    }
    const ok = await mark(rollNo, 'late', ncReason.trim())
    if (ok) {
      setNcFor(null)
      setNcReason('')
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
                  <span className="xls-sub-text">NC · {cap(row.ncReason || 'delayed')}</span>
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
