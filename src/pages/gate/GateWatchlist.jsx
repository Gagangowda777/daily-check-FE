import { useState } from 'react'

export default function GateWatchlist({ restrictions = [], onInspect }) {
  const [gradeFilter, setGradeFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()

  const filtered = restrictions.filter((r) => {
    if (gradeFilter !== 'ALL' && r.grade !== gradeFilter) return false
    if (!query) return true
    return (
      r.rollNo.toLowerCase().includes(query) ||
      r.name.toLowerCase().includes(query) ||
      (r.classLabel && r.classLabel.toLowerCase().includes(query)) ||
      (r.restrictionReason && r.restrictionReason.toLowerCase().includes(query))
    )
  })

  return (
    <div className="gate-table-card">
      <div className="gate-filter-row">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className={`gate-tab ${gradeFilter === 'ALL' ? 'is-active' : ''}`}
            onClick={() => setGradeFilter('ALL')}
          >
            All Grades <span className="gate-tab-count">{restrictions.length}</span>
          </button>
          <button
            type="button"
            className={`gate-tab ${gradeFilter === 'PU1' ? 'is-active' : ''}`}
            onClick={() => setGradeFilter('PU1')}
          >
            PU1 (11th){' '}
            <span className="gate-tab-count">
              {restrictions.filter((r) => r.grade === 'PU1').length}
            </span>
          </button>
          <button
            type="button"
            className={`gate-tab ${gradeFilter === 'PU2' ? 'is-active' : ''}`}
            onClick={() => setGradeFilter('PU2')}
          >
            PU2 (12th){' '}
            <span className="gate-tab-count">
              {restrictions.filter((r) => r.grade === 'PU2').length}
            </span>
          </button>
        </div>

        <input
          type="search"
          className="gate-filter-input"
          placeholder="Filter by roll, name, reason..."
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
              <th>Restriction Reason</th>
              <th>Resolution Status</th>
              <th>Duration</th>
              <th>Gate Rule</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-state">
                  No active exit restrictions matching current filters.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.rollNo}>
                  <td>
                    <strong>{item.rollNo}</strong>
                  </td>
                  <td>
                    <span style={{ fontWeight: 700 }}>{item.name}</span>
                  </td>
                  <td>
                    <span className="badge-status is-blue">{item.classLabel}</span>
                  </td>
                  <td style={{ color: '#b91c1c', fontWeight: 600 }}>
                    {item.restrictionReason}
                  </td>
                  <td>
                    <span className="badge-status is-amber">
                      {item.resolutionStatus || 'pending'}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: '#475467' }}>
                    {item.restrictionUntilResolved
                      ? 'Until resolved'
                      : item.restrictionEndDate
                      ? `Until ${item.restrictionEndDate}`
                      : 'Today'}
                  </td>
                  <td>
                    <span className="badge-status is-red">🛑 Block Exit</span>
                  </td>
                  <td>
                    {onInspect && (
                      <button
                        type="button"
                        className="btn-action-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => onInspect(item.rollNo)}
                      >
                        Inspect
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
