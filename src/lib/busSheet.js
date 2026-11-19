export const routeNumber = (route) => {
  const match = String(route || '').match(/\d+/)
  return match ? Number(match[0]) : 999
}

// Late-bus rows arrive as one row per student. The sheet wants one row per
// route with the students listed underneath it, exactly like the workbook.
export function groupLateBuses(rows = [], classLabel = '') {
  const map = new Map()
  for (const row of rows) {
    const route = row.route || 'No route'
    if (!map.has(route)) {
      map.set(route, { route, arrivalTime: row.arrivalTime || null, late: true, students: [] })
    }
    const bus = map.get(route)
    if (!bus.arrivalTime && row.arrivalTime) bus.arrivalTime = row.arrivalTime
    bus.students.push({
      rollNo: row.rollNo,
      name: row.name,
      classLabel: row.classLabel || classLabel,
      minutesLate: row.minutesLate,
    })
  }
  return [...map.values()].sort((a, b) => routeNumber(a.route) - routeNumber(b.route))
}
