import { useState, useEffect } from 'react'
import { api } from '../../lib/api.js'

export default function GateCheck({ data, onRefresh, onNotice, onError }) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [checkedStudent, setCheckedStudent] = useState(null)
  const [checkError, setCheckError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [remarks, setRemarks] = useState('')
  const [showRemarksInput, setShowRemarksInput] = useState(false)

  useEffect(() => {
    const onInspect = (event) => {
      if (event.detail) {
        const roll = String(event.detail).trim().toUpperCase()
        setQuery(roll)
        setSearching(true)
        api
          .gateCheck(roll)
          .then((res) => {
            setCheckedStudent(res)
            setCheckError('')
          })
          .catch((err) => setCheckError(err.message))
          .finally(() => setSearching(false))
      }
    }
    window.addEventListener('gate:inspect', onInspect)
    return () => window.removeEventListener('gate:inspect', onInspect)
  }, [])

  const handleSearch = async (e) => {
    if (e) e.preventDefault()
    const rollNo = query.trim().toUpperCase()
    if (!rollNo) return

    setSearching(true)
    setCheckError('')
    setCheckedStudent(null)
    setShowRemarksInput(false)
    setRemarks('')

    try {
      const res = await api.gateCheck(rollNo)
      setCheckedStudent(res)
    } catch (err) {
      setCheckError(err.message || `No student found with roll number "${rollNo}"`)
    } finally {
      setSearching(false)
    }
  }

  const handleLogAction = async (type, status, passDetails = '') => {
    if (!checkedStudent?.student?.rollNo) return
    setActionBusy(true)
    try {
      await api.gateLog({
        rollNo: checkedStudent.student.rollNo,
        type, // 'exit' | 'entry' | 'blocked_attempt'
        status,
        passDetails: passDetails || checkedStudent.clearance.reason || '',
        remarks: remarks.trim(),
      })
      onNotice(
        `${type === 'blocked_attempt' ? 'Blocked attempt logged' : 'Exit verified'} for ${checkedStudent.student.name} (${checkedStudent.student.rollNo})`
      )
      // Refresh check status
      const updated = await api.gateCheck(checkedStudent.student.rollNo)
      setCheckedStudent(updated)
      setShowRemarksInput(false)
      setRemarks('')
      onRefresh()
    } catch (err) {
      onError(err.message)
    } finally {
      setActionBusy(false)
    }
  }

  const handleQuickLogExit = async (rollNo, passReason) => {
    setActionBusy(true)
    try {
      await api.gateLog({
        rollNo,
        type: 'exit',
        status: 'authorized',
        passDetails: passReason || 'Authorized gate pass',
        remarks: '',
      })
      onNotice(`Exit verified for roll number ${rollNo}`)
      onRefresh()
      if (checkedStudent?.student?.rollNo === rollNo) {
        const updated = await api.gateCheck(rollNo)
        setCheckedStudent(updated)
      }
    } catch (err) {
      onError(err.message)
    } finally {
      setActionBusy(false)
    }
  }

  const pendingPasses = (data?.passes || []).filter((p) => !p.exited)

  return (
    <div className="gate-section">
      {/* Scanner Box */}
      <div className="scanner-card">
        <div className="scanner-header">
          <div>
            <h2 className="scanner-title">Student Roll No Scanner / Lookup</h2>
            <p className="scanner-sub">
              Enter student roll number or scan student ID card to immediately check exit authorization.
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="scanner-form">
          <div className="scanner-input-wrap">
            <svg
              className="scanner-icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="scanner-input"
              placeholder="e.g. 25A201 or scan student barcode..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <button type="submit" className="scanner-btn" disabled={searching || !query.trim()}>
            {searching ? 'Checking…' : 'Check Clearance'}
          </button>
          {checkedStudent && (
            <button
              type="button"
              className="btn-action-secondary"
              onClick={() => {
                setCheckedStudent(null)
                setQuery('')
                setCheckError('')
              }}
            >
              Clear
            </button>
          )}
        </form>

        {checkError && <div className="error-banner">{checkError}</div>}

        {/* Clearance Card Result */}
        {checkedStudent && (
          <div
            className={`clearance-result ${
              checkedStudent.clearance.isBlocked
                ? 'is-blocked'
                : checkedStudent.clearance.isAuthorized
                ? 'is-authorized'
                : 'is-regular'
            }`}
          >
            <div className="clearance-badge-bar">
              <span
                className={`clearance-pill ${
                  checkedStudent.clearance.isBlocked
                    ? 'blocked'
                    : checkedStudent.clearance.isAuthorized
                    ? 'authorized'
                    : 'regular'
                }`}
              >
                {checkedStudent.clearance.isBlocked
                  ? '🛑 Exit Restricted / Blocked'
                  : checkedStudent.clearance.isAuthorized
                  ? '🟢 Authorized for Exit'
                  : '⚪ Regular Student (No Early Pass)'}
              </span>

              {checkedStudent.clearance.isExited && (
                <span className="badge-status is-blue">
                  ✓ Exited Campus Today {checkedStudent.clearance.exitedAt ? `at ${checkedStudent.clearance.exitedAt}` : ''}
                </span>
              )}
            </div>

            <div className="clearance-student-info">
              <span className="student-name-lg">{checkedStudent.student.name}</span>
              <span className="student-meta-lg">
                Roll No: <strong>{checkedStudent.student.rollNo}</strong> · Class: <strong>{checkedStudent.student.classLabel}</strong>
                {checkedStudent.student.busRoute && ` · Bus: ${checkedStudent.student.busRoute}`}
              </span>
            </div>

            <div className="clearance-details-box">
              <p>
                <strong>Status Detail: </strong>
                {checkedStudent.clearance.details}
              </p>
              {checkedStudent.clearance.reason && (
                <p style={{ marginTop: '4px' }}>
                  <strong>Reason: </strong>
                  {checkedStudent.clearance.reason}
                </p>
              )}
              {checkedStudent.clearance.approvedBy && (
                <p style={{ marginTop: '4px' }}>
                  <strong>Approved By: </strong>
                  {checkedStudent.clearance.approvedBy} · <strong>Exit Time: </strong>
                  {checkedStudent.clearance.exitTime || 'Anytime'}
                </p>
              )}
            </div>

            {showRemarksInput && (
              <div style={{ marginTop: '6px' }}>
                <input
                  type="text"
                  className="gate-filter-input"
                  style={{ width: '100%' }}
                  placeholder="Optional remarks (e.g. parent accompanied, gate pass signed, incident notes)..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
            )}

            <div className="clearance-actions">
              {checkedStudent.clearance.isBlocked ? (
                <>
                  <button
                    type="button"
                    className="btn-action-block"
                    disabled={actionBusy}
                    onClick={() =>
                      handleLogAction(
                        'blocked_attempt',
                        'blocked',
                        `Attempted exit with active restriction: ${checkedStudent.clearance.reason}`
                      )
                    }
                  >
                    Log Blocked Exit Attempt
                  </button>
                  <button
                    type="button"
                    className="btn-action-secondary"
                    onClick={() => setShowRemarksInput(!showRemarksInput)}
                  >
                    {showRemarksInput ? 'Hide Remarks' : '+ Add Incident Remarks'}
                  </button>
                </>
              ) : checkedStudent.clearance.isAuthorized ? (
                <>
                  <button
                    type="button"
                    className="btn-action-exit"
                    disabled={actionBusy}
                    onClick={() =>
                      handleLogAction(
                        'exit',
                        'authorized',
                        checkedStudent.clearance.reason
                      )
                    }
                  >
                    {checkedStudent.clearance.isExited ? 'Re-Log Departure' : '✓ Verify & Log Campus Exit'}
                  </button>
                  <button
                    type="button"
                    className="btn-action-secondary"
                    onClick={() => setShowRemarksInput(!showRemarksInput)}
                  >
                    {showRemarksInput ? 'Hide Remarks' : '+ Add Remarks'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-action-exit"
                    style={{ background: '#2563eb' }}
                    disabled={actionBusy}
                    onClick={() =>
                      handleLogAction(
                        'exit',
                        'regular',
                        'Standard exit / early release'
                      )
                    }
                  >
                    Log Early Departure
                  </button>
                  <button
                    type="button"
                    className="btn-action-secondary"
                    disabled={actionBusy}
                    onClick={() =>
                      handleLogAction(
                        'entry',
                        'late_entry',
                        'Late arrival through main gate'
                      )
                    }
                  >
                    Log Late Entry
                  </button>
                  <button
                    type="button"
                    className="btn-action-secondary"
                    onClick={() => setShowRemarksInput(!showRemarksInput)}
                  >
                    {showRemarksInput ? 'Hide Remarks' : '+ Add Remarks'}
                  </button>
                </>
              )}
            </div>

            {/* Student's recent gate history */}
            {checkedStudent.recentLogs && checkedStudent.recentLogs.length > 0 && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>
                  Recent Gate Activity for this Student:
                </span>
                <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12.5px', color: '#475467' }}>
                  {checkedStudent.recentLogs.map((log) => (
                    <li key={log._id}>
                      <strong>{log.date} at {log.time}</strong> — {log.type === 'blocked_attempt' ? '🛑 Exit Blocked' : log.type === 'exit' ? '↗ Exited' : '↙ Entered'} ({log.status}) {log.remarks ? `[${log.remarks}]` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Queue of Pending Passes Today */}
      <div className="gate-section">
        <div className="gate-section-title">
          <span>Pending Authorized Exits Today</span>
          <span className="gate-tab-count">{pendingPasses.length}</span>
        </div>

        {pendingPasses.length === 0 ? (
          <div className="pass-card" style={{ textAlign: 'center', padding: '24px' }}>
            <span style={{ color: '#8a94a6', fontSize: '13.5px' }}>
              No pending authorized exits at the moment. All approved students have departed or none scheduled.
            </span>
          </div>
        ) : (
          <div className="gate-queue-grid">
            {pendingPasses.slice(0, 6).map((pass) => (
              <div key={pass.id} className="pass-card">
                <div className="pass-card-head">
                  <div>
                    <div className="pass-card-name">{pass.name}</div>
                    <div className="pass-card-meta">
                      {pass.rollNo} · {pass.classLabel}
                    </div>
                  </div>
                  <span className="pass-card-time">{pass.exitTime || 'Today'}</span>
                </div>

                <div className="pass-card-reason">{pass.reason}</div>

                <div className="pass-card-foot">
                  <span className="pass-card-author">{pass.approvedBy}</span>
                  <button
                    type="button"
                    className="btn-mini-log"
                    disabled={actionBusy}
                    onClick={() => handleQuickLogExit(pass.rollNo, pass.reason)}
                  >
                    Log Exit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
