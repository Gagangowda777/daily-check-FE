import { BusArrivalsSheet } from '../../components/ExcelSheet.jsx'
import { groupLateBuses } from '../../lib/busSheet.js'

// Read-only view of today's late bus arrivals for this section, in the same
// route / arrival / late / students layout as the daily-check workbook.
export default function TeacherBuses({ data }) {
  const buses = groupLateBuses(data.lateBuses, data.label)

  return (
    <BusArrivalsSheet
      buses={buses}
      title="Late bus arrivals"
      meta={`${buses.length} late route${buses.length === 1 ? '' : 's'} · Cut-off ${data.cutoff}`}
      note={`Buses that reached campus after the ${data.cutoff} cut-off, with the students late on each route.`}
      empty="No late buses for this section."
    />
  )
}
