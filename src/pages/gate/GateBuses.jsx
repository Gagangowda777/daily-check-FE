import { useState } from 'react'

export default function GateBuses({ buses = [] }) {
  const [filter, setFilter] = useState('all') // 'all' | 'arrived' | 'not-arrived' | 'late'
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()

  const filtered = buses.filter((b) => {
    const isArrived = b.arrivalTime !== null
    const isLate = Boolean(b.overrideLate !== null && b.overrideLate !== undefined ? b.overrideLate : b.late)

    if (filter === 'arrived' && !isArrived) return false
    if (filter === 'not-arrived' && isArrived) return false
    if (filter === 'late' && !isLate) return false

    if (!query) return true
    return b.route.toLowerCase().includes(query)
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
            All Routes <span className="gate-tab-count">{buses.length}</span>
          </button>
          <button
            type="button"
            className={`gate-tab ${filter === 'arrived' ? 'is-active' : ''}`}
            onClick={() => setFilter('arrived')}
          >
            Arrived{' '}
            <span className="gate-tab-count">
              {buses.filter((b) => b.arrivalTime !== null).length}
            </span>
          </button>
          <button
            type="button"
            className={`gate-tab ${filter === 'not-arrived' ? 'is-active' : ''}`}
            onClick={() => setFilter('not-arrived')}
          >
            Not Arrived{' '}
            <span className="gate-tab-count">
              {buses.filter((b) => b.arrivalTime === null).length}
            </span>
          </button>
          <button
            type="button"
            className={`gate-tab ${filter === 'late' ? 'is-active' : ''}`}
            onClick={() => setFilter('late')}
          >
            Late Arrivals{' '}
            <span className="gate-tab-count">
              {buses.filter((b) => b.late || b.overrideLate).length}
            </span>
          </button>
        </div>

        <input
          type="search"
          className="gate-filter-input"
          placeholder="Search route (e.g. R5)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="gate-table-wrap">
        <table className="gate-table">
          <thead>
            <tr>
              <th>Route</th>
              <th>Gate Arrival Time</th>
              <th>Scheduled Cut-off</th>
              <th>Status</th>
              <th>Riders / Students</th>
              <th>Override Notes</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-state">
                  No bus routes matching current filters.
                </td>
              </tr>
            ) : (
              filtered.map((bus) => {
                const isArrived = bus.arrivalTime !== null
                const isLate = Boolean(
                  bus.overrideLate !== null && bus.overrideLate !== undefined
                    ? bus.overrideLate
                    : bus.late
                )

                return (
                  <tr key={bus.route}>
                    <td>
                      <strong style={{ fontSize: '14px', color: '#2563eb' }}>{bus.route}</strong>
                    </td>
                    <td>
                      {isArrived ? (
                        <span style={{ fontWeight: 700, color: '#0b1220' }}>{bus.arrivalTime}</span>
                      ) : (
                        <span style={{ color: '#8a94a6' }}>— (Pending)</span>
                      )}
                    </td>
                    <td style={{ color: '#475467' }}>{bus.scheduledTime || '08:45'}</td>
                    <td>
                      {!isArrived ? (
                        <span className="badge-status is-amber">⏳ En Route</span>
                      ) : isLate ? (
                        <span className="badge-status is-red">🛑 Late Arrival</span>
                      ) : (
                        <span className="badge-status is-green">✓ On Time</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{bus.affectedStudents || 0}</span>
                    </td>
                    <td style={{ fontSize: '12.5px', color: '#64748b' }}>
                      {bus.overrideReason || '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
