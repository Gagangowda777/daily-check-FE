import { useState } from 'react'
import { BusArrivalsSheet } from '../../components/ExcelSheet.jsx'

export default function GateBuses({ buses = [] }) {
  const [filter, setFilter] = useState('all') // 'all' | 'arrived' | 'not-arrived' | 'late'
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()

  const isLateBus = (bus) =>
    Boolean(
      bus.overrideLate !== null && bus.overrideLate !== undefined ? bus.overrideLate : bus.late
    )

  const filtered = buses.filter((bus) => {
    const isArrived = bus.arrivalTime !== null
    const isLate = isLateBus(bus)

    if (filter === 'arrived' && !isArrived) return false
    if (filter === 'not-arrived' && isArrived) return false
    if (filter === 'late' && !isLate) return false

    if (!query) return true
    return bus.route.toLowerCase().includes(query)
  })

  const rows = filtered.map((bus) => ({
    route: bus.route,
    scheduledTime: bus.scheduledTime,
    cutoff: bus.cutoff,
    arrivalTime: bus.arrivalTime,
    late: isLateBus(bus),
    affectedStudents: bus.affectedStudents || 0,
    // The workbook lists the students under their route; on-time routes stay
    // compact with just a count so the page does not turn into a wall of names.
    students: isLateBus(bus) ? bus.students || [] : [],
  }))

  const cutoffs = [...new Set(buses.map((bus) => bus.cutoff).filter(Boolean))]
  const meta =
    cutoffs.length === 1
      ? `Cut-off ${cutoffs[0]}`
      : cutoffs.length > 1
        ? 'Route-specific cut-offs'
        : 'Cut-off 08:22'

  const toolbar = (
    <div className="xls-toolbar">
      {[
        { id: 'all', label: `All routes ${buses.length}` },
        { id: 'arrived', label: `Arrived ${buses.filter((b) => b.arrivalTime !== null).length}` },
        {
          id: 'not-arrived',
          label: `Not arrived ${buses.filter((b) => b.arrivalTime === null).length}`,
        },
        { id: 'late', label: `Late ${buses.filter((b) => isLateBus(b)).length}` },
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
        placeholder="Route (e.g. R5)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>
  )

  return (
    <BusArrivalsSheet
      buses={rows}
      title="Bus arrivals"
      meta={meta}
      note="Morning bus arrivals through the main gate. Students late on each route are listed in the last column."
      empty="No bus routes matching current filters."
      toolbar={toolbar}
      showSchedule
    />
  )
}
