import { useState } from 'react'
import { ExcelSheet } from '../../components/ExcelSheet.jsx'
import { cap } from '../../lib/text.js'

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

  const toolbar = (
    <div className="xls-toolbar">
      {[
        { id: 'ALL', label: `All grades ${restrictions.length}` },
        {
          id: 'PU1',
          label: `PU1 ${restrictions.filter((r) => r.grade === 'PU1').length}`,
        },
        {
          id: 'PU2',
          label: `PU2 ${restrictions.filter((r) => r.grade === 'PU2').length}`,
        },
      ].map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`xls-pill${gradeFilter === tab.id ? ' is-active' : ''}`}
          onClick={() => setGradeFilter(tab.id)}
        >
          {tab.label}
        </button>
      ))}
      <input
        type="search"
        className="gate-filter-input"
        placeholder="Filter by roll, name, reason..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>
  )

  return (
    <ExcelSheet
      title="Exit restriction watchlist"
      meta={`${filtered.length} of ${restrictions.length} students`}
      note="Students prohibited from leaving campus during school hours."
      toolbar={toolbar}
      columns={[
        'Sl. no.',
        'Roll no',
        'Student',
        'Class',
        'Restriction reason',
        'Resolution',
        'Duration',
        'Gate rule',
        'Action',
      ]}
    >
      {filtered.length === 0 ? (
        <tr>
          <td className="xls-empty" colSpan={9}>
            No active exit restrictions matching current filters.
          </td>
        </tr>
      ) : (
        filtered.map((item, index) => (
          <tr key={item.rollNo} className="xls-row">
            <td className="xls-no">{index + 1}</td>
            <td className="xls-name">{item.rollNo}</td>
            <td>{item.name}</td>
            <td>
              <span className="xls-badge is-blue">{item.classLabel}</span>
            </td>
            <td>{item.restrictionReason}</td>
            <td>
              <span className="xls-badge is-late">
                {cap(item.resolutionStatus || 'pending')}
              </span>
            </td>
            <td>
              {item.restrictionUntilResolved
                ? 'Until resolved'
                : item.restrictionEndDate
                  ? `Until ${item.restrictionEndDate}`
                  : 'Today'}
            </td>
            <td>
              <span className="xls-badge is-alert">Block exit</span>
            </td>
            <td className="xls-actions">
              {onInspect ? (
                <button
                  type="button"
                  className="btn-action-secondary"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                  onClick={() => onInspect(item.rollNo)}
                >
                  Inspect
                </button>
              ) : null}
            </td>
          </tr>
        ))
      )}
    </ExcelSheet>
  )
}
