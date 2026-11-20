import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import ExcelFeedPanel from './ExcelFeedPanel.jsx'
import { BusArrivalsSheet } from './ExcelSheet.jsx'
import { cap } from '../lib/text.js'

const TABS = [
  { id: 'handover', label: 'Hand-over queue' },
  { id: 'exit', label: 'Exit restrictions' },
  { id: 'buses', label: 'Bus arrivals' },
  { id: 'excel-feed', label: 'Excel & Data Feed' },
  { id: 'settings', label: 'Settings & audit' },
]

const STATUS_FILTERS = ['ALL', 'pending', 'acknowledged', 'absent', 'excused', 'resolved']
const ROUTES = Array.from({ length: 27 }, (_, index) => `R${index + 1}`)
const todayIso = () => new Date().toLocaleDateString('en-CA')
const classOf = (row) => `${row.grade === 'PU1' ? '11' : '12'}${row.section}`

const waitLabel = (minutes) => {
  if (minutes === null || Number.isNaN(minutes)) return '-'
  const safe = Math.max(0, minutes)
  const hours = Math.floor(safe / 60)
  return hours > 0 ? `${hours}h ${String(safe % 60).padStart(2, '0')}m` : `${safe}m`
}

const clockMinutes = (clock) => {
  if (!clock) return null
  const [hours, minutes] = clock.split(':').map(Number)
  return hours * 60 + minutes
}

export default function ModuleTabs({ date, onChanged }) {
  const [tab, setTab] = useState('handover')

  return (
    <section className="tabs-card">
      <div className="tabs" role="tablist" aria-label="Module views">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`tab${tab === item.id ? ' is-active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="tab-panel">
        {tab === 'handover' ? <HandoverPanel date={date} onChanged={onChanged} /> : null}
        {tab === 'exit' ? <ExitPanel date={date} onChanged={onChanged} /> : null}
        {tab === 'buses' ? <BusPanel date={date} onChanged={onChanged} /> : null}
        {tab === 'excel-feed' ? <ExcelFeedPanel date={date} onChanged={onChanged} /> : null}
        {tab === 'settings' ? <SettingsPanel /> : null}
      </div>
    </section>
  )
}

function HandoverPanel({ date, onChanged }) {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState({ key: '', rows: [] })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [clock, setClock] = useState(() => new Date())

  const key = `${date}:${version}`

  useEffect(() => {
    let alive = true
    api
      .handovers({ date })
      .then((data) => {
        if (alive) setState({ key, rows: data.rows })
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [date, key])

  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const isToday = date === todayIso()
  const nowMinutes = isToday ? clock.getHours() * 60 + clock.getMinutes() : null

  const act = async (rollNo, outcome) => {
    setBusy(rollNo)
    setError('')
    try {
      await api.handoverOutcome(rollNo, { outcome, date })
      setVersion((value) => value + 1)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  // Never show the previous date's queue while the new one loads.
  const rows = state.key === key ? state.rows : []
  const since = (row) => (clockMinutes(row.handoverAt) === null ? null : row.handoverAt)

  return (
    <div>
      {error ? <p className="form-error">{error}</p> : null}

      {rows.length === 0 ? (
        <p className="empty">No students waiting at the desk for this date.</p>
      ) : (
        <ul className="queue">
          {rows.map((row) => (
            <li key={row.rollNo} className="queue-item">
              <div className="queue-main">
                <strong>{row.name}</strong>
                <span className="picked-meta">
                  {row.rollNo} · {classOf(row)} · {row.restrictionReason || 'Hand-over'}
                </span>
              </div>
              <div className="queue-timer">
                <span className="queue-since">In from {since(row) || '-'}</span>
                {!isToday ? (
                  <span className="queue-wait">Historic</span>
                ) : clockMinutes(row.handoverAt) === null ? (
                  <span className="queue-wait">No arrival time logged</span>
                ) : (
                  <span className="queue-wait">
                    Waiting {waitLabel(nowMinutes - clockMinutes(row.handoverAt))}
                  </span>
                )}
              </div>
              <div className="queue-actions">
                <button
                  type="button"
                  className="mini-button"
                  disabled={busy === row.rollNo}
                  onClick={() => act(row.rollNo, 'cleared')}
                >
                  Cleared &amp; Sent to Class
                </button>
                <button
                  type="button"
                  className="mini-button"
                  disabled={busy === row.rollNo}
                  onClick={() => act(row.rollNo, 'sent-home')}
                >
                  Sent Home
                </button>
                <button
                  type="button"
                  className="mini-button"
                  disabled={busy === row.rollNo}
                  onClick={() => act(row.rollNo, 'parent-called')}
                >
                  Parent Called
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ExitPanel({ date, onChanged }) {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState({ key: '', rows: [] })
  const [status, setStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const [action, setAction] = useState(null)
  const [note, setNote] = useState('')
  const [approver, setApprover] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const key = `${date}:${version}`

  useEffect(() => {
    let alive = true
    api
      .exitRestrictions({ date })
      .then((data) => {
        if (!alive) return
        setError('')
        setState({ key, rows: data.rows })
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [date, key])

  const term = search.trim().toLowerCase()
  const rows = (state.key === key ? state.rows : []).filter((row) => {
    if (status !== 'ALL' && row.resolutionStatus !== status) return false
    if (!term) return true
    return (
      row.name.toLowerCase().includes(term) || row.rollNo.toLowerCase().includes(term)
    )
  })

  const submit = async (row, mode) => {
    setBusy(true)
    setError('')
    try {
      if (mode === 'resolve') {
        await api.resolveExit(row.rollNo, { note, date })
      } else {
        await api.excuseExit(row.rollNo, { approver, endDate, date })
      }
      setAction(null)
      setNote('')
      setApprover('')
      setEndDate('')
      setVersion((value) => value + 1)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="filter-row">
        <select
          className="form-input"
          value={status}
          aria-label="Filter by status"
          onChange={(event) => setStatus(event.target.value)}
        >
          {STATUS_FILTERS.map((item) => (
            <option key={item} value={item}>
              {item === 'ALL' ? 'All statuses' : item}
            </option>
          ))}
        </select>
        <input
          className="form-input"
          placeholder="Search name or roll no"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <span className="muted">{rows.length} students</span>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {rows.length === 0 ? (
        <p className="empty">No exit restrictions match this filter.</p>
      ) : (
        <ul className="queue">
          {rows.map((row) => (
            <li key={row.rollNo} className="queue-item">
              <div className="queue-main">
                <strong>
                  {row.name}
                  {row.repeatResolutions >= 2 ? (
                    <span className="repeat-badge">{row.repeatResolutions}× repeat</span>
                  ) : null}
                </strong>
                <span className="picked-meta">
                  {row.rollNo} · {classOf(row)} · {row.restrictionReason} ·{' '}
                  {row.restrictionUntilResolved
                    ? 'Until resolved'
                    : row.restrictionEndDate
                      ? `Until ${row.restrictionEndDate}`
                      : 'No end date'}
                </span>
                {row.resolutionNote ? (
                  <span className="picked-meta">Note: {row.resolutionNote}</span>
                ) : null}
                {row.excusedApprover ? (
                  <span className="picked-meta">Approved by {row.excusedApprover}</span>
                ) : null}
              </div>

              <span className={`badge ${row.resolutionStatus}`}>{cap(row.resolutionStatus)}</span>

              {row.resolutionStatus === 'resolved' ? (
                <span className="muted queue-actions">
                  {row.resolutionNote ? `Resolved: ${row.resolutionNote}` : 'Resolved, final'}
                </span>
              ) : (
                <div className="queue-actions">
                  <button
                    type="button"
                    className="mini-button"
                    onClick={() => {
                      setAction({ rollNo: row.rollNo, mode: 'resolve' })
                      setNote('')
                      setError('')
                    }}
                  >
                    Resolved
                  </button>
                  <button
                    type="button"
                    className="mini-button"
                    onClick={() => {
                      setAction({ rollNo: row.rollNo, mode: 'excuse' })
                      setApprover('')
                      setEndDate(date)
                      setError('')
                    }}
                  >
                    Excused
                  </button>
                </div>
              )}

              {action?.rollNo === row.rollNo && row.resolutionStatus !== 'resolved' ? (
                <div className="inline-form">
                  {action.mode === 'resolve' ? (
                    <label className="inline-field">
                      <span>Resolution note (required)</span>
                      <input
                        className="form-input"
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="What was resolved?"
                      />
                    </label>
                  ) : (
                    <>
                      <label className="inline-field">
                        <span>Approver</span>
                        <input
                          className="form-input"
                          value={approver}
                          onChange={(event) => setApprover(event.target.value)}
                          placeholder="Who approved?"
                        />
                      </label>
                      <label className="inline-field">
                        <span>End date</span>
                        <input
                          className="form-input"
                          type="date"
                          value={endDate}
                          onChange={(event) => setEndDate(event.target.value)}
                        />
                      </label>
                    </>
                  )}
                  <div className="inline-actions">
                    <button type="button" className="ghost-button" onClick={() => setAction(null)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="action-button"
                      disabled={busy}
                      onClick={() => submit(row, action.mode)}
                    >
                      {busy ? 'Saving…' : action.mode === 'resolve' ? 'Save resolution' : 'Save excuse'}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BusPanel({ date, onChanged }) {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState({ key: '', rows: [] })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')

  const key = `${date}:${version}`

  useEffect(() => {
    let alive = true
    api
      .buses({ date })
      .then((data) => {
        if (!alive) return
        setError('')
        setNotice('')
        setState({ key, rows: data.rows })
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [date, key])

  const convert = async (route) => {
    setBusy(route)
    setError('')
    setNotice('')
    try {
      const result = await api.convertBus(route, { date })
      setNotice(
        `${route}: ${result.created} exit restriction(s) created` +
          `${result.skipped ? `, ${result.skipped} skipped (entry restriction)` : ''}` +
          ` (${result.reason}).`
      )
      // Refetch so the card and late counts reflect the conversion.
      setVersion((value) => value + 1)
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const rows = state.key === key ? state.rows : []
  const lateCount = rows.filter((row) => row.status !== 'on-time').length

  return (
    <div>
      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="action-notice">{notice}</p> : null}

      <p className="muted bus-summary">
        {rows.length} routes · {lateCount} late or missing
      </p>

      <BusArrivalsSheet
        buses={rows.map((row) => ({
          route: row.route,
          arrivalTime: row.arrivalTime,
          late: row.status !== 'on-time',
          affectedStudents: row.lateStudents,
          status: row.status,
          override: row.override,
        }))}
        title="Bus arrivals"
        meta={`${rows.length} routes · ${lateCount} late or missing`}
        note="Routes that reached campus after the 8:20 am cut-off."
        empty="No bus data for today."
        renderActions={(bus) =>
          bus.status !== 'on-time' && bus.affectedStudents > 0 ? (
            <button
              type="button"
              className="tap"
              disabled={busy === bus.route}
              onClick={() => convert(bus.route)}
            >
              {busy === bus.route ? 'Converting…' : 'Convert to exit'}
            </button>
          ) : null
        }
      />
    </div>
  )
}

function SettingsPanel() {
  const [settings, setSettings] = useState(null)
  const [reasons, setReasons] = useState('')
  const [subjects, setSubjects] = useState('')
  const [cutoff, setCutoff] = useState('08:20')
  const [routeCutoffs, setRouteCutoffs] = useState({})
  const [newRoute, setNewRoute] = useState('R1')
  const [newTime, setNewTime] = useState('08:20')
  const [audit, setAudit] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const loadAudit = () =>
    api
      .audit(30)
      .then((data) => setAudit(data.rows))
      .catch((err) => setError(err.message))

  useEffect(() => {
    let alive = true
    Promise.all([api.settings(), api.audit(30)])
      .then(([config, log]) => {
        if (!alive) return
        setSettings(config)
        setReasons(config.exitReasons.join('\n'))
        setSubjects(config.entrySubjects.join('\n'))
        setCutoff(config.busCutoff)
        setRouteCutoffs(config.routeCutoffs || {})
        setAudit(log.rows)
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [])

  const save = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const saved = await api.saveSettings({
        exitReasons: reasons.split('\n').map((line) => line.trim()).filter(Boolean),
        entrySubjects: subjects.split('\n').map((line) => line.trim()).filter(Boolean),
        busCutoff: cutoff,
        routeCutoffs,
      })
      setSettings(saved)
      setRouteCutoffs(saved.routeCutoffs || {})
      setNotice('Settings saved.')
      await loadAudit()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!settings) {
    return <p className="empty">{error || 'Loading settings…'}</p>
  }

  return (
    <div className="settings">
      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="action-notice">{notice}</p> : null}

      <div className="settings-grid">
        <label className="inline-field">
          <span>Exit restriction reasons (one per line)</span>
          <textarea
            className="form-input textarea"
            rows={8}
            value={reasons}
            onChange={(event) => setReasons(event.target.value)}
          />
        </label>

        <label className="inline-field">
          <span>Entry pending subjects (one per line)</span>
          <textarea
            className="form-input textarea"
            rows={8}
            value={subjects}
            onChange={(event) => setSubjects(event.target.value)}
          />
        </label>

        <div className="inline-field">
          <span>Default bus late cut-off</span>
          <input
            className="form-input"
            type="time"
            value={cutoff}
            onChange={(event) => setCutoff(event.target.value)}
          />

          <span className="form-label route-label">Route-specific cut-offs</span>
          {Object.keys(routeCutoffs).length === 0 ? (
            <p className="muted">Using the default cut-off for every route.</p>
          ) : (
            <ul className="cutoff-list">
              {Object.entries(routeCutoffs).map(([route, time]) => (
                <li key={route}>
                  <strong>{route}</strong>
                  <input
                    className="form-input cutoff-time"
                    type="time"
                    value={time}
                    onChange={(event) =>
                      setRouteCutoffs((current) => ({ ...current, [route]: event.target.value }))
                    }
                  />
                  <button
                    type="button"
                    className="mini-button"
                    onClick={() =>
                      setRouteCutoffs((current) => {
                        const next = { ...current }
                        delete next[route]
                        return next
                      })
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="cutoff-add">
            <select
              className="form-input"
              value={newRoute}
              aria-label="Route"
              onChange={(event) => setNewRoute(event.target.value)}
            >
              {ROUTES.map((route) => (
                <option key={route} value={route}>
                  {route}
                </option>
              ))}
            </select>
            <input
              className="form-input"
              type="time"
              value={newTime}
              aria-label="Cut-off time"
              onChange={(event) => setNewTime(event.target.value)}
            />
            <button
              type="button"
              className="mini-button"
              onClick={() =>
                setRouteCutoffs((current) => ({ ...current, [newRoute]: newTime }))
              }
            >
              Add override
            </button>
          </div>
        </div>
      </div>

      <div className="submit-row">
        <button type="button" className="action-button" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      <section className="audit">
        <h4>Audit log (read-only)</h4>
        {audit.length === 0 ? (
          <p className="muted">No entries yet.</p>
        ) : (
          <ul className="audit-list">
            {audit.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                <span className="audit-time">
                  {new Date(entry.at).toLocaleString(undefined, {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <strong>{entry.action}</strong>
                <span className="audit-detail">{entry.detail}</span>
                <span className="audit-actor">{entry.actor}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
