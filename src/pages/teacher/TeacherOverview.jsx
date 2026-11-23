import { routeHref } from '../../lib/router.js'

// The class teacher's landing screen: today's numbers for the section, each
// row linking to the screen that carries the detail.
const Stat = ({ label, value, note, tone }) => (
  <div className={`stat${tone ? ` is-${tone}` : ''}`}>
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
    {note ? <span className="stat-note">{note}</span> : null}
  </div>
)

export default function TeacherOverview({ data }) {
  const summary = data.attendance?.summary || { present: 0, absent: 0, late: 0, nc: 0 }
  const roster = (data.attendance?.rows || []).length
  const ncStudents = Array.isArray(data.nc.students)
    ? data.nc.students
    : (data.attendance?.rows || []).filter((row) => row.ncFlag)
  const exitOpen = (data.exit || []).filter((row) =>
    ['pending', 'acknowledged'].includes(row.status)
  ).length
  const adminRows = data.adminData?.rows?.length || 0
  const adminAcknowledged = data.adminData?.acknowledgedCount || 0

  const rows = [
    {
      key: 'attendance',
      label: 'Attendance',
      href: routeHref('teacher/attendance'),
      value: `${summary.present} present`,
      detail: `${summary.absent} absent · ${summary.late} late`,
      tone: summary.absent ? 'alert' : 'ok',
    },
    {
      key: 'buses',
      label: 'Late bus arrivals',
      href: routeHref('teacher/buses'),
      value: `${data.lateBuses.length}`,
      detail: data.lateBuses.length ? 'students on a late bus' : 'All buses on time',
      tone: data.lateBuses.length ? 'alert' : 'ok',
    },
    {
      key: 'exit',
      label: 'Exit restrictions',
      href: routeHref('teacher/attendance'),
      value: `${exitOpen} open`,
      detail: `${(data.exit || []).length} flagged today`,
      tone: exitOpen ? 'alert' : 'ok',
    },
    {
      key: 'entry',
      label: 'Entry checks',
      href: routeHref('teacher/attendance'),
      value: `${(data.entry || []).length}`,
      detail: data.entry.length ? 'subject checks with you' : 'Nothing pending',
      tone: data.entry.length ? 'alert' : 'ok',
    },
    {
      key: 'nc',
      label: 'Students with an NC',
      href: routeHref('teacher/nc'),
      value: `${ncStudents.length}`,
      detail: data.nc.updatedInNe ? 'Count updated in NE' : 'NE update pending',
      tone: ncStudents.length ? 'alert' : 'ok',
    },
    {
      key: 'admin-data',
      label: 'Admin data',
      href: routeHref('teacher/admin-data'),
      value: `${adminRows} rows`,
      detail: data.adminData?.announcedAt
        ? `${adminAcknowledged} acknowledged`
        : 'Not announced yet',
      tone: adminRows ? undefined : 'ok',
    },
  ]

  const open = rows.filter((row) => row.tone === 'alert').length

  return (
    <>
      <div className="stat-grid">
        <Stat
          label="Present"
          value={summary.present}
          note={`of ${roster} on the roster`}
          tone={roster && summary.present === roster ? 'ok' : undefined}
        />
        <Stat
          label="Absent"
          value={summary.absent}
          note={summary.late ? `${summary.late} late` : 'No late marks'}
          tone={summary.absent ? 'alert' : 'ok'}
        />
        <Stat
          label="Late buses"
          value={data.lateBuses.length}
          note={data.lateBuses.length ? 'Students affected' : 'None today'}
          tone={data.lateBuses.length ? 'alert' : 'ok'}
        />
        <Stat
          label="NC count"
          value={data.nc.count ?? '-'}
          note={data.nc.updatedInNe ? 'Updated in NE' : 'Not updated in NE'}
          tone={data.nc.updatedInNe ? 'ok' : 'warn'}
        />
      </div>

      <section className="t-card">
        <div className="t-card-head">
          <h2>Section overview</h2>
          <span className={`t-count${open ? ' is-alert' : ' is-ok'}`}>
            {open ? `${open} need attention` : 'All clear'}
          </span>
        </div>
        <div className="t-body">
          <ul className="ov-list">
            {rows.map((row) => (
              <li key={row.key} className="ov-item">
                <a href={row.href}>{row.label}</a>
                <span className="ov-detail">{row.detail}</span>
                <span className={`t-count${row.tone === 'alert' ? ' is-alert' : ''}`}>
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
