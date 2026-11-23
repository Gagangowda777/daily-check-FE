import { BusArrivalsSheet } from '../../components/ExcelSheet.jsx'
import { groupLateBuses } from '../../lib/busSheet.js'

export default function LeaderBuses({ data }) {
  const buses = groupLateBuses(data.lateBuses, data.label)
  const routeCutoffs = data.routeCutoffs || {}
  const routeSpecific = Object.keys(routeCutoffs).length > 0

  return (
    <BusArrivalsSheet
      buses={buses}
      title="Late bus arrivals"
      meta={`${buses.length} late route${buses.length === 1 ? '' : 's'} · ${
        routeSpecific ? 'Route-specific cut-offs' : `Cut-off ${data.cutoff}`
      }`}
      note={
        routeSpecific
          ? 'Buses that reached campus after their route cut-off, with the students late on each route.'
          : `Buses that reached campus after the ${data.cutoff} cut-off, with the students late on each route.`
      }
      empty="No late buses for this section."
    />
  )
}
