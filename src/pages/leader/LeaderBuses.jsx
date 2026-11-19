import { BusArrivalsSheet } from '../../components/ExcelSheet.jsx'
import { groupLateBuses } from '../../lib/busSheet.js'

export default function LeaderBuses({ data }) {
  const buses = groupLateBuses(data.lateBuses, data.label)

  return (
    <BusArrivalsSheet
      buses={buses}
      title="Late bus arrivals"
      meta={`${buses.length} late route${buses.length === 1 ? '' : 's'} · cut-off ${data.cutoff}`}
      note={`Buses that reached campus after the ${data.cutoff} cut-off, with the students late on each route.`}
      empty="No late buses for this section."
    />
  )
}
