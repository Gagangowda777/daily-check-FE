import { useState } from 'react'
import { ExcelSheet } from '../../components/ExcelSheet.jsx'

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

  const toolbar = (
    <div className="xls-toolbar">
      {[
        { id: 'all', label: `All movements ${logs.length}` },
        { id: 'exit', label: `Exits ${logs.filter((l) => l.type === 'exit').length}` },
        {
          id: 'blocked_attempt',
          label: `Blocked ${logs.filter((l) => l.type === 'blocked_attempt').length}`,
        },
        { id: 'entry', label: `Entries ${logs.filter((l) => l.type === 'entry').length}` },
      ].map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`xls-pill${filter === tab.id ? ' is-active' : ''}`}
          onClick={() => setFilter(tab.id)}
        >
          {tab.label}
        </button>
      ))}
      <input
        type="search"
        className="gate-filter-input"
        placeholder="Filter logs by roll, name, remarks..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>
  )

  return (
    <ExcelSheet
      title="Gate movement log"
      meta={`${filteredLogs.length} of ${logs.length} events`}
      note="Chronological record of campus entries, exits and blocked attempts today."
      toolbar={toolbar}
      columns={[
        'Sl. no.',
        'Time',
        'Event',
        'Roll no',
        'Student',
        'Class',
        'Status',
        'Pass / reason',
        'Logged by',
        'Remarks',
      ]}
    >
      {filteredLogs.length === 0 ? (
        <tr>
          <td className="xls-empty" colSpan={10}>
            No gate movement events logged today.
          </td>
        </tr>
      ) : (
        filteredLogs.map((log, index) => (
          <tr key={log._id || `${log.rollNo}-${log.time}`} className="xls-row">
            <td className="xls-no">{index + 1}</td>
            <td className="xls-time">{log.time}</td>
            <td>
              {log.type === 'blocked_attempt' ? (
                <span className="badge-status is-red">Blocked</span>
              ) : log.type === 'exit' ? (
                <span className="badge-status is-green">Exit</span>
              ) : (
                <span className="badge-status is-blue">Entry</span>
              )}
            </td>
            <td className="xls-name">{log.rollNo}</td>
            <td>{log.name}</td>
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
            <td>{log.passDetails || '—'}</td>
            <td>{log.loggedBy || 'Security'}</td>
            <td>{log.remarks || '—'}</td>
          </tr>
        ))
      )}
    </ExcelSheet>
  )
}
