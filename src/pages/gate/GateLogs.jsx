import { useState } from 'react'

export default function GateLogs({ logs = [] }) {
  const [filter, setFilter] = useState('all') // 'all' | 'exit' | 'blocked_attempt' | 'entry'
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()

  const filteredLogs = logs.filter((log) => {
    if (filter !== 'all' && log.type !== filter) return false
    if (!query) return true
    return (
      (log.rollNo && log.rollNo.toLowerCase().includes(query)) ||
      (log.name && log.name.toLowerCase().includes(query)) ||
      (log.remarks && log.remarks.toLowerCase().includes(query)) ||
      (log.passDetails && log.passDetails.toLowerCase().includes(query)) ||
      (log.section && log.section.toLowerCase().includes(query))
    )
  })

  return (
    <div className="gate-table-card">
      <div className="gate-filter-row">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`gate-tab ${filter === 'all' ? 'is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Movements <span className="gate-tab-count">{logs.length}</span>
          </button>
          <button
            type="button"
            className={`gate-tab ${filter === 'exit' ? 'is-active' : ''}`}
            onClick={() => setFilter('exit')}
          >
            Exits{' '}
            <span className="gate-tab-count">
              {logs.filter((l) => l.type === 'exit').length}
            </span>
          </button>
          <button
            type="button"
            className={`gate-tab ${filter === 'blocked_attempt' ? 'is-active' : ''}`}
            onClick={() => setFilter('blocked_attempt')}
          >
            Blocked Attempts{' '}
            <span className="gate-tab-count">
              {logs.filter((l) => l.type === 'blocked_attempt').length}
            </span>
          </button>
          <button
            type="button"
            className={`gate-tab ${filter === 'entry' ? 'is-active' : ''}`}
            onClick={() => setFilter('entry')}
          >
            Entries{' '}
            <span className="gate-tab-count">
              {logs.filter((l) => l.type === 'entry').length}
            </span>
          </button>
        </div>

        <input
          type="search"
          className="gate-filter-input"
          placeholder="Filter logs by roll, name, remarks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="gate-table-wrap">
        <table className="gate-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event Type</th>
              <th>Roll No</th>
              <th>Student Name</th>
              <th>Class</th>
              <th>Status / Clearance</th>
              <th>Pass / Reason</th>
              <th>Guard / Logged By</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="9" className="empty-state">
                  No gate movement events logged today.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log._id || `${log.rollNo}-${log.time}`}>
                  <td style={{ fontWeight: 700, color: '#0b1220' }}>{log.time}</td>
                  <td>
                    {log.type === 'blocked_attempt' ? (
                      <span className="badge-status is-red">🛑 Blocked Attempt</span>
                    ) : log.type === 'exit' ? (
                      <span className="badge-status is-green">↗ Exit Logged</span>
                    ) : (
                      <span className="badge-status is-blue">↙ Entry Logged</span>
                    )}
                  </td>
                  <td>
                    <strong>{log.rollNo}</strong>
                  </td>
                  <td style={{ fontWeight: 700 }}>{log.name}</td>
                  <td>
                    <span className="badge-status is-blue">
                      {log.grade === 'PU1' ? '11' : '12'}
                      {log.section}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge-status ${
                        log.status === 'blocked'
                          ? 'is-red'
                          : log.status === 'authorized'
                          ? 'is-green'
                          : 'is-gray'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '12.5px', color: '#475467', maxWidth: '240px' }}>
                    {log.passDetails || '—'}
                  </td>
                  <td style={{ fontSize: '12px', color: '#64748b' }}>
                    {log.loggedBy || 'Security'}
                  </td>
                  <td style={{ fontSize: '12.5px', color: '#334155', maxWidth: '200px' }}>
                    {log.remarks || '—'}
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
