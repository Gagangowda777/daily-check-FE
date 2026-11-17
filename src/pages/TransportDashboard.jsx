import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import Shell from '../components/Shell.jsx'
import '../transport.css'

const FILTERS = [
  { id: 'all', label: 'All routes' },
  { id: 'not-arrived', label: 'Not arrived' },
  { id: 'on-time', label: 'On time' },
  { id: 'late', label: 'Late' },
]

const STATUS_LABEL = {
  'not-arrived': 'Not arrived',
  'on-time': 'On time',
  late: 'Late',
}

const nowClock = () => {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

export default function TransportDashboard({ session, onSignOut }) {
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

  return (
    <Shell
      user={{ name: 'Transport In-charge', role: session.email }}
      nav={[{ id: 'routes', label: 'Bus routes' }]}
      activeNav="routes"
      crumb="Transport"
      title="Bus routes"
      subtitle={
        data
          ? `${data.date} · ${data.routes.length} routes · late cut-off ${data.cutoffs.default}`
          : 'Loading routes…'
      }
      onSignOut={onSignOut}
    >
      <div className="tr-body">
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
            { id: 'on-time', label: 'On time', value: counts['on-time'] },
            { id: 'late', label: 'Late', value: counts.late },
          ].map((card) => (
            <div key={card.id} className={`tr-stat is-${card.id}`}>
              <strong>{data ? card.value : '—'}</strong>
              <span>{card.label}</span>
            </div>
          ))}
        </section>

        <section className="tr-controls">
          <div className="tr-tabs" role="group" aria-label="Filter routes">
            {FILTERS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`tr-tab${filter === tab.id ? ' is-active' : ''}`}
                onClick={() => setFilter(tab.id)}
              >
                {tab.label}
                <span className="tr-tab-count">{counts[tab.id === 'all' ? 'all' : tab.id]}</span>
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
        </section>

        {!data ? <p className="tr-empty">Loading today’s routes…</p> : null}
        {data && visible.length === 0 ? (
          <p className="tr-empty">No routes match that filter.</p>
        ) : null}

        {visible.map((route) => {
          const open = openRoute === route.route
          const editing = timeEdit?.route === route.route
          const overriding = overrideFor?.route === route.route

          return (
            <article key={route.route} className={`tr-route${open ? ' is-open' : ''}`}>
              <button
                type="button"
                className="tr-route-head"
                aria-expanded={open}
                onClick={() => setOpenRoute(open ? null : route.route)}
              >
                <span className="tr-route-title">
                  <span className="tr-route-id">{route.route}</span>
                  <span className={`tr-status is-${route.status}`}>{STATUS_LABEL[route.status]}</span>
                </span>
                <span className="tr-route-meta">
                  Cut-off {route.cutoff}
                  {route.scheduledTime ? ` · scheduled ${route.scheduledTime}` : ''}
                  {route.arrivalTime
                    ? ` · arrived ${route.arrivalTime}`
                    : ' · not arrived yet'}
                  {route.status === 'late' && !route.override && route.minutesLate
                    ? ` · ${route.minutesLate} min late`
                    : route.override
                      ? ' · status overridden'
                      : ''}
                  {` · ${route.riders}/${route.students.length} riding`}
                </span>
              </button>

              {route.override ? (
                <p className="tr-override-note">
                  Manually set {route.override.late ? 'Late' : 'On time'} at {route.override.at} —{' '}
                  {route.override.reason}
                </p>
              ) : null}

              <div className="tr-route-actions">
                {route.arrivalTime === null ? (
                  <button
                    type="button"
                    className="tap"
                    disabled={busy === `arrive-${route.route}`}
                    onClick={() =>
                      run(
                        `arrive-${route.route}`,
                        () => api.transportArrive(route.route, { time: nowClock() }),
                        `${route.route} logged as arrived at ${nowClock()}.`
                      )
                    }
                  >
                    Mark arrived
                  </button>
                ) : (
                  <button
                    type="button"
                    className="tap is-quiet"
                    onClick={() => setTimeEdit({ route: route.route, value: route.arrivalTime })}
                  >
                    Edit time
                  </button>
                )}

                <button
                  type="button"
                  className="tap is-quiet"
                  onClick={() =>
                    setOverrideFor({ route: route.route, late: route.late, reason: '' })
                  }
                >
                  Override status
                </button>

                <button
                  type="button"
                  className="tap is-quiet"
                  onClick={() => setOpenRoute(open ? null : route.route)}
                >
                  {open ? 'Hide students' : 'Students'}
                </button>
              </div>

              {editing ? (
                <div className="tr-inline">
                  <input
                    className="input tr-time"
                    type="time"
                    aria-label={`Arrival time for ${route.route}`}
                    value={timeEdit.value}
                    onChange={(event) => setTimeEdit({ route: route.route, value: event.target.value })}
                  />
                  <button
                    type="button"
                    className="tap"
                    disabled={busy === `time-${route.route}`}
                    onClick={async () => {
                      const saved = await run(
                        `time-${route.route}`,
                        () => api.transportTime(route.route, { time: timeEdit.value }),
                        `${route.route} arrival time updated.`
                      )
                      if (saved) setTimeEdit(null)
                    }}
                  >
                    Save time
                  </button>
                  <button type="button" className="tap is-quiet" onClick={() => setTimeEdit(null)}>
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
                      onClick={() => setOverrideFor({ ...overrideFor, late: true })}
                    >
                      Late
                    </button>
                    <button
                      type="button"
                      className={`tap${overrideFor.late ? ' is-quiet' : ''}`}
                      onClick={() => setOverrideFor({ ...overrideFor, late: false })}
                    >
                      On time
                    </button>
                  </div>
                  <input
                    className="input"
                    placeholder="Reason (required)"
                    aria-label="Override reason"
                    value={overrideFor.reason}
                    onChange={(event) =>
                      setOverrideFor({ ...overrideFor, reason: event.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="tap"
                    disabled={busy === `override-${route.route}`}
                    onClick={async () => {
                      const saved = await run(
                        `override-${route.route}`,
                        () =>
                          api.transportOverride(route.route, {
                            late: overrideFor.late,
                            reason: overrideFor.reason,
                          }),
                        `${route.route} status overridden.`
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
                    {route.riders} of {route.students.length} students riding — untick anyone absent
                    today.
                  </p>
                  {route.students.map((student) => (
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
                              api.transportRider(route.route, student.rollNo, {
                                riding: !student.rider,
                              }),
                            student.rider
                              ? `${student.name} marked absent — not counted late.`
                              : `${student.name} back on the route.`
                          )
                        }
                      />
                      <span className="tr-student-name">{student.name}</span>
                      <span className="tr-student-meta">
                        {student.rollNo} · {student.section}
                      </span>
                      {student.busLate ? <span className="tr-student-late">late</span> : null}
                    </label>
                  ))}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </Shell>
  )
}
