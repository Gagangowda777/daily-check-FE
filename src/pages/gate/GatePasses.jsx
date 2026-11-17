import { useState } from 'react'
import { api } from '../../lib/api.js'

export default function GatePasses({ passes = [], onRefresh, onNotice, onError }) {
  const [filter, setFilter] = useState('all') // 'all' | 'pending' | 'exited'
  const [search, setSearch] = useState('')
  const [busyRoll, setBusyRoll] = useState(null)

  const query = search.trim().toLowerCase()

  const filteredPasses = passes.filter((p) => {
    if (filter === 'pending' && p.exited) return false
    if (filter === 'exited' && !p.exited) return false
    if (!query) return true
    return (
      p.rollNo.toLowerCase().includes(query) ||
      p.name.toLowerCase().includes(query) ||
      p.classLabel.toLowerCase().includes(query) ||
      (p.reason && p.reason.toLowerCase().includes(query)) ||
      (p.approvedBy && p.approvedBy.toLowerCase().includes(query))
    )
  })

  const pendingCount = passes.filter((p) => !p.exited).length
  const exitedCount = passes.filter((p) => p.exited).length

  const handleLogExit = async (pass) => {
    setBusyRoll(pass.rollNo)
    try {
      await api.gateLog({
        rollNo: pass.rollNo,
        type: 'exit',
        status: 'authorized',
        passDetails: pass.reason || 'Authorized gate pass',
        remarks: '',
      })
      onNotice(`Campus departure logged for ${pass.name} (${pass.rollNo})`)
      onRefresh()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusyRoll(null)
    }
  }

  return (
    <div className="gate-table-card">
      <div className="gate-filter-row">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className={`gate-tab ${filter === 'all' ? 'is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Passes <span className="gate-tab-count">{passes.length}</span>
          </button>
          <button
            type="button"
            className={`gate-tab ${filter === 'pending' ? 'is-active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pending Exit <span className="gate-tab-count">{pendingCount}</span>
          </button>
          <button
            type="button"
            className={`gate-tab ${filter === 'exited' ? 'is-active' : ''}`}
            onClick={() => setFilter('exited')}
          >
            Departed <span className="gate-tab-count">{exitedCount}</span>
          </button>
        </div>

        <input
          type="search"
          className="gate-filter-input"
          placeholder="Filter by roll, name, class, reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="gate-table-wrap">
        <table className="gate-table">
          <thead>
            <tr>
              <th>Roll No</th>
              <th>Student Name</th>
              <th>Class</th>
              <th>Approved Exit</th>
              <th>Approver</th>
              <th>Reason / Gate Pass</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredPasses.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-state">
                  No authorized passes matching current filter.
                </td>
              </tr>
            ) : (
              filteredPasses.map((pass) => (
                <tr key={pass.id}>
                  <td>
                    <strong>{pass.rollNo}</strong>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700 }}>{pass.name}</span>
                  </td>
                  <td>
                    <span className="badge-status is-blue">{pass.classLabel}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#2563eb' }}>
                      {pass.exitTime || 'Today'}
                    </span>
                  </td>
                  <td style={{ color: '#475467', fontSize: '12.5px' }}>
                    {pass.approvedBy || 'Teacher'}
                  </td>
                  <td style={{ maxWidth: '280px', color: '#334155', fontSize: '12.5px' }}>
                    {pass.reason}
                  </td>
                  <td>
                    {pass.exited ? (
                      <span className="badge-status is-green">✓ Departed</span>
                    ) : (
                      <span className="badge-status is-amber">⏳ Pending Exit</span>
                    )}
                  </td>
                  <td>
                    {pass.exited ? (
                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                        Logged
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn-mini-log"
                        disabled={busyRoll === pass.rollNo}
                        onClick={() => handleLogExit(pass)}
                      >
                        {busyRoll === pass.rollNo ? 'Logging…' : 'Log Exit'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
