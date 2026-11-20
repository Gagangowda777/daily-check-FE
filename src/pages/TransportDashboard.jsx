import { Fragment, useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { pageFor, routeHref } from '../lib/router.js'
import Shell from '../components/Shell.jsx'
import { ExcelSheet } from '../components/ExcelSheet.jsx'
import InboxHub from '../components/InboxHub.jsx'
import TransportInbox from './transport/TransportInbox.jsx'
import '../transport.css'

const FILTERS = [
  { id: 'all', label: 'All routes' },
  { id: 'not-arrived', label: 'Not arrived' },
  { id: 'on-time', label: 'On time' },
  { id: 'late', label: 'Late' },
]

const STATUS_LABEL = {
  'not-arrived': 'Not arrived',
  'on-time': 'Not late',
  late: 'Late',
}

const nowClock = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

const NAV = [
  { id: 'routes', label: 'Bus routes', href: routeHref('transport/routes') },
  { id: 'inbox', label: 'Inbox', href: routeHref('transport/inbox') },
]

const PAGE_META = {
  routes: { title: 'Bus routes', subtitle: 'Mark arrivals and keep the route status honest' },
  inbox: { title: 'Inbox', subtitle: 'Messages from the admin and the rest of the school' },
}

export default function TransportDashboard({ session, route, onSignOut }) {
  const page = pageFor(route, 'transport', 'routes')
  const meta = PAGE_META[page] || PAGE_META.routes
  const [version, setVersion] = useState(0)
  const [state, setState] = useState({ key: '', data: null })
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [openRoute, setOpenRoute] = useState(null)
  const [timeEdit, setTimeEdit] = useState(null)
  const [overrideFor, setOverrideFor] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const key = `transport:${version}`
  const data = state.data

  useEffect(() => {
    let alive = true
    api
      .transportToday({})
      .then((payload) => {
        if (!alive) return
        setState({ key, data: payload })
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [key])

  const run = async (id, action, message) => {
    setBusy(id)
    setError('')
    setNotice('')
    try {
      await action()
      if (message) setNotice(message)
      setVersion((value) => value + 1)
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusy('')
    }
  }

  const query = search.trim().toLowerCase()

  const visible = (data?.routes || []).filter((route) => {
    if (filter !== 'all' && route.status !== filter) return false
    if (!query) return true
    if (route.route.toLowerCase() === query || route.route.toLowerCase().includes(query)) return true
    return route.students.some((student) => student.name.toLowerCase().includes(query))
  })

  const counts = {
    all: data?.routes.length || 0,
    'not-arrived': data?.summary.notArrived || 0,
    'on-time': data?.summary.onTime || 0,
    late: data?.summary.late || 0,
  }

  const toolbar = (
    <div className="xls-toolbar">
      <div className="tr-tabs" role="group" aria-label="Filter routes">
        {FILTERS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`xls-pill${filter === tab.id ? ' is-active' : ''}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label} {counts[tab.id]}
          </button>
        ))}
      </div>
      <input
        className="input tr-search"
        type="search"
        placeholder="Search route or student"
        aria-label="Search route or student"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
    </div>
  )

  return (
    <Shell
      user={{ name: 'Transport In-charge', role: session.email }}
      nav={NAV}
      activeNav={page}
      crumb="Transport"
      title={meta.title}
      subtitle={
        page === 'inbox'
          ? meta.subtitle
          : data
            ? `${data.date} · ${data.routes.length} routes · Late cut-off ${data.cutoffs.default}`
            : 'Loading routes…'
      }
      onSignOut={onSignOut}
    >
      <div className="tr-body">
        {page === 'inbox' ? (
          <InboxHub>
            <TransportInbox />
          </InboxHub>
        ) : (
          <>
            {error ? (
              <div className="banner" role="alert">
                {error}
              </div>
            ) : null}
            {notice ? (
              <p className="action-notice" role="status">
                {notice}
              </p>
            ) : null}

            <section className="tr-summary" aria-label="Route status">
              {[
                { id: 'not-arrived', label: 'Not arrived', value: counts['not-arrived'] },
                { id: 'on-time', label: 'Not late', value: counts['on-time'] },
                { id: 'late', label: 'Late', value: counts.late },
              ].map((card) => (
                <div key={card.id} className={`tr-stat is-${card.id}`}>
                  <strong>{data ? card.value : '-'}</strong>
                  <span>{card.label}</span>
                </div>
              ))}
            </section>

            {!data ? <p className="tr-empty">Loading today’s routes…</p> : null}

            {data ? (
              <ExcelSheet
                title="Bus routes"
                meta={`Cut-off ${data.cutoffs.default} · ${data.routes.length} routes`}
                note="Arrival, late status and the students riding each route. Untick anyone absent before marking the bus."
                toolbar={toolbar}
                columns={['Sl. no.', 'Route', 'Arrival', 'Late / Not late', 'Students', 'Actions']}
              >
                {visible.length === 0 ? (
                  <tr>
                    <td className="xls-empty" colSpan={6}>
                      No routes match that filter.
                    </td>
                  </tr>
                ) : (
                  visible.map((bus, index) => {
                    const open = openRoute === bus.route
                    const editing = timeEdit?.route === bus.route
                    const overriding = overrideFor?.route === bus.route
                    const lateCount = bus.students.filter((student) => student.busLate).length

                    return (
                      <Fragment key={bus.route}>
                        <tr className={`xls-row ${bus.late ? 'is-late' : 'is-ok'}`}>
                          <td className="xls-no">{index + 1}</td>
                          <td className="xls-route">{bus.route}</td>
                          <td className="xls-time">{bus.arrivalTime || '-'}</td>
                          <td>
                            <span
                              className={`xls-badge ${
                                bus.status === 'on-time'
                                  ? 'is-ok'
                                  : bus.status === 'late'
                                    ? 'is-late'
                                    : 'is-pending'
                              }`}
                            >
                              {STATUS_LABEL[bus.status]}
                            </span>
                            {bus.override ? (
                              <span className="xls-sub-text">Overridden: {bus.override.reason}</span>
                            ) : bus.status === 'late' && bus.minutesLate ? (
                              <span className="xls-sub-text">{bus.minutesLate} min late</span>
                            ) : null}
                          </td>
                          <td>
                            <span className="xls-count">
                              {bus.riders}/{bus.students.length} riding
                              {lateCount ? ` · ${lateCount} late` : ''}
                            </span>
                          </td>
                          <td className="xls-actions">
                            <div className="t-actions">
                              {bus.arrivalTime === null ? (
                                <button
                                  type="button"
                                  className="tap"
                                  disabled={busy === `arrive-${bus.route}`}
                                  onClick={() =>
                                    run(
                                      `arrive-${bus.route}`,
                                      () => api.transportArrive(bus.route, { time: nowClock() }),
                                      `${bus.route} logged as arrived at ${nowClock()}.`
                                    )
                                  }
                                >
                                  Mark arrived
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="tap is-quiet"
                                  onClick={() =>
                                    setTimeEdit({ route: bus.route, value: bus.arrivalTime })
                                  }
                                >
                                  Edit time
                                </button>
                              )}

                              <button
                                type="button"
                                className="tap is-quiet"
                                onClick={() =>
                                  setOverrideFor({
                                    route: bus.route,
                                    late: bus.late,
                                    reason: '',
                                  })
                                }
                              >
                                Override
                              </button>

                              <button
                                type="button"
                                className="tap is-quiet"
                                onClick={() => setOpenRoute(open ? null : bus.route)}
                              >
                                {open ? 'Hide' : 'Students'}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {editing || overriding || open ? (
                          <tr className="xls-sub">
                            <td colSpan={6}>
                              {editing ? (
                                <div className="tr-inline">
                                  <input
                                    className="input tr-time"
                                    type="time"
                                    aria-label={`Arrival time for ${bus.route}`}
                                    value={timeEdit.value}
                                    onChange={(event) =>
                                      setTimeEdit({ route: bus.route, value: event.target.value })
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="tap"
                                    disabled={busy === `time-${bus.route}`}
                                    onClick={async () => {
                                      const saved = await run(
                                        `time-${bus.route}`,
                                        () => api.transportTime(bus.route, { time: timeEdit.value }),
                                        `${bus.route} arrival time updated.`
                                      )
                                      if (saved) setTimeEdit(null)
                                    }}
                                  >
                                    Save time
                                  </button>
                                  <button
                                    type="button"
                                    className="tap is-quiet"
                                    onClick={() => setTimeEdit(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : null}

                              {overriding ? (
                                <div className="tr-inline tr-override-form">
                                  <div className="tr-override-toggle">
                                    <button
                                      type="button"
                                      className={`tap${overrideFor.late ? '' : ' is-quiet'}`}
                                      onClick={() =>
                                        setOverrideFor({ ...overrideFor, late: true })
                                      }
                                    >
                                      Late
                                    </button>
                                    <button
                                      type="button"
                                      className={`tap${overrideFor.late ? ' is-quiet' : ''}`}
                                      onClick={() =>
                                        setOverrideFor({ ...overrideFor, late: false })
                                      }
                                    >
                                      Not late
                                    </button>
                                  </div>
                                  <input
                                    className="input"
                                    placeholder="Reason (required)"
                                    aria-label="Override reason"
                                    value={overrideFor.reason}
                                    onChange={(event) =>
                                      setOverrideFor({
                                        ...overrideFor,
                                        reason: event.target.value,
                                      })
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="tap"
                                    disabled={busy === `override-${bus.route}`}
                                    onClick={async () => {
                                      const saved = await run(
                                        `override-${bus.route}`,
                                        () =>
                                          api.transportOverride(bus.route, {
                                            late: overrideFor.late,
                                            reason: overrideFor.reason,
                                          }),
                                        `${bus.route} status overridden.`
                                      )
                                      if (saved) setOverrideFor(null)
                                    }}
                                  >
                                    Save status
                                  </button>
                                  <button
                                    type="button"
                                    className="tap is-quiet"
                                    onClick={() => setOverrideFor(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : null}

                              {open ? (
                                <div className="tr-students">
                                  <p className="tr-students-head">
                                    {bus.riders} of {bus.students.length} students riding. Untick
                                    anyone absent today.
                                  </p>
                                  {bus.students.map((student) => (
                                    <label
                                      key={student.rollNo}
                                      className={`tr-student${student.rider ? '' : ' is-off'}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={student.rider}
                                        disabled={busy === `rider-${student.rollNo}`}
                                        onChange={() =>
                                          run(
                                            `rider-${student.rollNo}`,
                                            () =>
                                              api.transportRider(bus.route, student.rollNo, {
                                                riding: !student.rider,
                                              }),
                                            student.rider
                                              ? `${student.name} marked absent, not counted late.`
                                              : `${student.name} back on the route.`
                                          )
                                        }
                                      />
                                      <span className="tr-student-name">{student.name}</span>
                                      <span className="tr-student-meta">
                                        {student.rollNo} · {student.section}
                                      </span>
                                      {student.busLate ? (
                                        <span className="tr-student-late">Late</span>
                                      ) : null}
                                    </label>
                                  ))}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })
                )}
              </ExcelSheet>
            ) : null}
          </>
        )}
      </div>
    </Shell>
  )
}
