import { Fragment, useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { ExcelSheet } from './ExcelSheet.jsx'
import '../transport.css'

// The same route-management screen is used by the transport desk and the
// super admin. Both read and write Student.busRoute, BusLog and Settings, so
// there is one transport record rather than a copy per dashboard.
export default function TransportRouteManagement() {
  const [version, setVersion] = useState(0)
  const [state, setState] = useState({ key: '', routes: null, today: null })
  const [routeDrafts, setRouteDrafts] = useState({})
  const [studentEdit, setStudentEdit] = useState({
    route: '',
    rows: [],
    drafts: {},
    loading: false,
    error: '',
  })
  const [nameDrafts, setNameDrafts] = useState({})
  const [sectionsByGrade, setSectionsByGrade] = useState({ PU1: [], PU2: [] })
  const [addForm, setAddForm] = useState({ rollNo: '', name: '', grade: '', section: '' })
  const [addBusy, setAddBusy] = useState(false)
  const [openDetails, setOpenDetails] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const key = `routes:${version}`
  const routeData = state.routes
  const todayData = state.today

  useEffect(() => {
    let alive = true
    // The class picker needs the section list only. `/auth/sections` is public,
    // so it works for the transport desk and the super admin too (the admin
    // `filters` endpoint is closed to those roles).
    Promise.all([api.transportToday({}), api.transportRoutes(), api.publicSections()])
      .then(([today, routes, filters]) => {
        if (!alive) return
        setState({ key, routes, today })
        setSectionsByGrade({
          PU1: filters.grades?.PU1 || [],
          PU2: filters.grades?.PU2 || [],
        })
        const drafts = {}
        for (const route of routes.routes || []) {
          drafts[route.route] = {
            cutoff: route.cutoff || routes.defaultCutoff || '',
          }
        }
        setRouteDrafts(drafts)
        setError('')
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [key])

  const setDraft = (route, values) =>
    setRouteDrafts((current) => ({
      ...current,
      [route]: { ...(current[route] || {}), ...values },
    }))

  const reload = (message) => {
    if (message) setNotice(message)
    setVersion((value) => value + 1)
  }

  const changedRoutes = (routeData?.routes || []).filter((bus) => {
    const draft = routeDrafts[bus.route]
    if (!draft) return false
    return draft.cutoff !== (bus.cutoff || routeData.defaultCutoff || '')
  })

  const saveRouteChanges = async () => {
    const changed = changedRoutes
    if (changed.length === 0) return
    setBusy('routes-save')
    setError('')
    setNotice('')
    try {
      for (const bus of changed) {
        await api.transportRouteUpdate(bus.route, {
          cutoff: routeDrafts[bus.route]?.cutoff || '',
        })
      }
      reload(
        `${changed.length} route${changed.length === 1 ? '' : 's'} saved.`
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const discardRouteChanges = () => {
    const drafts = {}
    for (const bus of routeData?.routes || []) {
      drafts[bus.route] = {
        cutoff: bus.cutoff || routeData.defaultCutoff || '',
      }
    }
    setRouteDrafts(drafts)
    setError('')
    setNotice('')
  }

  const closeStudentEdit = () => {
    setStudentEdit({ route: '', rows: [], drafts: {}, loading: false, error: '' })
    setNameDrafts({})
    setAddForm({ rollNo: '', name: '', grade: '', section: '' })
  }

  // The class picker for a student added from this sheet, built from the
  // sections that already exist on the roster.
  const sectionOptions = []
  for (const grade of ['PU1', 'PU2']) {
    for (const row of sectionsByGrade[grade] || []) {
      sectionOptions.push({
        grade,
        section: row.section,
        label: `${grade === 'PU1' ? '11' : '12'}${row.section}`,
      })
    }
  }

  const editStudents = async (bus) => {
    if (studentEdit.route === bus.route) {
      closeStudentEdit()
      return
    }
    setOpenDetails(null)
    setStudentEdit({ route: bus.route, rows: [], drafts: {}, loading: true, error: '' })
    try {
      const payload = await api.transportRouteStudents(bus.route)
      setStudentEdit((current) => {
        if (current.route !== bus.route) return current
        const drafts = {}
        const names = {}
        for (const student of payload.students || []) {
          drafts[student.rollNo] = student.busRoute || ''
          names[student.rollNo] = student.name
        }
        setNameDrafts(names)
        return { ...current, rows: payload.students || [], drafts, loading: false }
      })
    } catch (err) {
      setStudentEdit((current) =>
        current.route === bus.route
          ? { ...current, loading: false, error: err.message }
          : current
      )
    }
  }

  const changedStudents = studentEdit.rows.filter((student) => {
    const nextName = (nameDrafts[student.rollNo] ?? student.name).trim()
    return (
      (studentEdit.drafts[student.rollNo] || '') !== (student.busRoute || '') ||
      nextName !== student.name
    )
  })

  const saveStudents = async (bus) => {
    if (changedStudents.length === 0) return
    setBusy(`students-${bus.route}`)
    setError('')
    setNotice('')
    try {
      for (const student of changedStudents) {
        const nextName = (nameDrafts[student.rollNo] ?? student.name).trim()
        if (nextName && nextName !== student.name) {
          await api.transportRenameStudent(student.rollNo, { name: nextName })
        }
        const nextRoute = studentEdit.drafts[student.rollNo] || null
        if (nextRoute !== (student.busRoute || null)) {
          await api.transportReassignStudent(bus.route, student.rollNo, { route: nextRoute })
        }
      }
      setNotice(
        `${changedStudents.length} student${
          changedStudents.length === 1 ? '' : 's'
        } updated on ${bus.route}.`
      )
      closeStudentEdit()
      setVersion((value) => value + 1)
    } catch (err) {
      setError(err.message)
      closeStudentEdit()
      setVersion((value) => value + 1)
    } finally {
      setBusy('')
    }
  }

  // A new name is added to the route it was typed in; the roster, the day's
  // rows and the route log all follow, so the student counts straight away.
  const addStudent = async (bus) => {
    const rollNo = addForm.rollNo.trim().toUpperCase()
    const name = addForm.name.trim()
    if (!rollNo || !name || !addForm.grade || !addForm.section) {
      setStudentEdit((current) => ({
        ...current,
        error: 'Roll number, name and class are needed to add a student.',
      }))
      return
    }
    setAddBusy(true)
    setError('')
    setNotice('')
    setStudentEdit((current) => ({ ...current, error: '' }))
    try {
      await api.transportAddStudent(bus.route, {
        rollNo,
        name,
        grade: addForm.grade,
        section: addForm.section,
      })
      const payload = await api.transportRouteStudents(bus.route)
      const drafts = {}
      const names = {}
      for (const student of payload.students || []) {
        drafts[student.rollNo] = student.busRoute || ''
        names[student.rollNo] = student.name
      }
      setStudentEdit((current) =>
        current.route === bus.route
          ? { ...current, rows: payload.students || [], drafts }
          : current
      )
      setNameDrafts(names)
      setAddForm({ rollNo: '', name: '', grade: '', section: '' })
      setNotice(`${name} added to ${bus.route}.`)
      setVersion((value) => value + 1)
    } catch (err) {
      setStudentEdit((current) => ({ ...current, error: err.message }))
    } finally {
      setAddBusy(false)
    }
  }

  return (
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

      <ExcelSheet
        title="Route management"
        meta={
          routeData
            ? `${routeData.routes.length} routes · Default cut-off ${routeData.defaultCutoff}`
            : 'Loading routes'
        }
        note="Adjust a route late cut-off, rename a student, add a new name or move a student to another route. Saved changes use the shared transport records and appear on every dashboard that reads bus times."
        toolbar={
          changedRoutes.length > 0 ? (
            <div className="tr-save-tools" role="status">
              <span>
                {changedRoutes.length} unsaved change
                {changedRoutes.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                className="tap"
                disabled={busy === 'routes-save'}
                onClick={saveRouteChanges}
              >
                {busy === 'routes-save' ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                className="tap is-quiet"
                disabled={busy === 'routes-save'}
                onClick={discardRouteChanges}
              >
                Discard
              </button>
            </div>
          ) : null
        }
        columns={['Sl. no.', 'Route', 'Late cut-off', 'Students']}
      >
        {!routeData ? (
          <tr>
            <td className="xls-empty" colSpan={4}>
              Loading routes…
            </td>
          </tr>
        ) : routeData.routes.length === 0 ? (
          <tr>
            <td className="xls-empty" colSpan={4}>
              No routes are on record yet. Add students with a bus route first.
            </td>
          </tr>
        ) : (
          routeData.routes.map((bus, index) => {
            const draft = routeDrafts[bus.route] || {
              cutoff: bus.cutoff || routeData.defaultCutoff || '',
            }
            const todayBus = (todayData?.routes || []).find(
              (route) => route.route === bus.route
            )
            const detailsOpen = openDetails === bus.route
            const todayText = todayBus
              ? todayBus.arrivalTime
                ? `Arrived ${todayBus.arrivalTime} · ${
                    todayBus.status === 'late' ? 'Late' : 'Not late'
                  } · ${todayBus.riders} of ${todayBus.students.length} riding`
                : `Not arrived · ${todayBus.riders} of ${todayBus.students.length} riding`
              : 'No bus log for today'

            return (
              <Fragment key={bus.route}>
                <tr className="xls-row">
                  <td className="xls-no">{index + 1}</td>
                  <td className="xls-route">
                    <button
                      type="button"
                      className="tr-route-toggle"
                      aria-expanded={detailsOpen}
                      aria-label={`${detailsOpen ? 'Hide' : 'Show'} details for ${bus.route}`}
                      onClick={() => {
                        closeStudentEdit()
                        setOpenDetails(detailsOpen ? null : bus.route)
                      }}
                    >
                      {bus.route}
                      <span aria-hidden="true">{detailsOpen ? ' ▴' : ' ▾'}</span>
                    </button>
                  </td>
                  <td>
                    <input
                      className="input tr-time"
                      type="time"
                      aria-label={`Late cut-off for ${bus.route}`}
                      value={draft.cutoff}
                      onChange={(event) => setDraft(bus.route, { cutoff: event.target.value })}
                    />
                    <span className="xls-sub-text">
                      {bus.cutoffOverride ? 'Route cut-off' : 'Default cut-off'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="tap is-quiet"
                      aria-expanded={studentEdit.route === bus.route}
                      onClick={() => editStudents(bus)}
                    >
                      Edit students
                    </button>
                  </td>
                </tr>

                {detailsOpen ? (
                  <tr className="xls-sub">
                    <td colSpan={4}>
                      <div className="tr-route-details">
                        <div>
                          <span>Route</span>
                          <strong>{bus.route}</strong>
                        </div>
                        <div>
                          <span>Scheduled time</span>
                          <strong>{bus.scheduledTime || 'Not set'}</strong>
                        </div>
                        <div>
                          <span>Late cut-off</span>
                          <strong>
                            {bus.cutoff}{' '}
                            {bus.cutoffOverride
                              ? '(route override)'
                              : '(default cut-off)'}
                          </strong>
                        </div>
                        <div>
                          <span>Assigned students</span>
                          <strong>{bus.students}</strong>
                        </div>
                        <div>
                          <span>Today</span>
                          <strong>{todayText}</strong>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}

                {studentEdit.route === bus.route ? (
                  <tr className="xls-sub">
                    <td colSpan={4}>
                      <div className="tr-route-students">
                        <div className="tr-route-students-head">
                          <div>
                            <strong>{bus.route} students</strong>
                            <span>
                              Correct a name, choose another route, or add a new student.
                              Changes are saved together.
                            </span>
                          </div>
                          <div className="t-actions">
                            <button
                              type="button"
                              className="tap"
                              disabled={
                                busy === `students-${bus.route}` ||
                                studentEdit.loading ||
                                changedStudents.length === 0
                              }
                              onClick={() => saveStudents(bus)}
                            >
                              {busy === `students-${bus.route}`
                                ? 'Saving…'
                                : 'Save students'}
                            </button>
                            <button
                              type="button"
                              className="tap is-quiet"
                              onClick={closeStudentEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>

                        {studentEdit.error ? (
                          <p className="tr-route-students-error" role="alert">
                            {studentEdit.error}
                          </p>
                        ) : null}

                        {studentEdit.loading ? (
                          <p className="tr-route-students-empty">Loading students…</p>
                        ) : studentEdit.rows.length === 0 ? (
                          <p className="tr-route-students-empty">
                            No students are assigned to this route.
                          </p>
                        ) : (
                          <div className="tr-route-student-list">
                            {studentEdit.rows.map((student) => (
                              <div
                                key={student.rollNo}
                                className={`tr-route-student${
                                  (studentEdit.drafts[student.rollNo] || '') !==
                                    (student.busRoute || '') ||
                                  (nameDrafts[student.rollNo] ?? student.name).trim() !==
                                    student.name
                                    ? ' is-changed'
                                    : ''
                                }`}
                              >
                                <span className="tr-route-student-name">
                                  <input
                                    className="input tr-route-student-name-input"
                                    type="text"
                                    maxLength={80}
                                    aria-label={`Name for ${student.rollNo}`}
                                    value={nameDrafts[student.rollNo] ?? student.name}
                                    onChange={(event) =>
                                      setNameDrafts((current) => ({
                                        ...current,
                                        [student.rollNo]: event.target.value,
                                      }))
                                    }
                                  />
                                  <span>
                                    {student.rollNo} · {student.section}
                                  </span>
                                </span>
                                <select
                                  className="input tr-route-student-route"
                                  aria-label={`Bus route for ${student.name}`}
                                  value={studentEdit.drafts[student.rollNo] || ''}
                                  onChange={(event) =>
                                    setStudentEdit((current) => ({
                                      ...current,
                                      drafts: {
                                        ...current.drafts,
                                        [student.rollNo]: event.target.value,
                                      },
                                    }))
                                  }
                                >
                                  <option value="">No route</option>
                                  {routeData.routes.map((option) => (
                                    <option key={option.route} value={option.route}>
                                      {option.route}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        )}

                        {studentEdit.loading ? null : (
                          <div className="tr-route-add">
                            <input
                              className="input tr-route-add-roll"
                              type="text"
                              maxLength={20}
                              placeholder="Roll no"
                              aria-label={`Roll number for the student added to ${bus.route}`}
                              value={addForm.rollNo}
                              onChange={(event) =>
                                setAddForm({ ...addForm, rollNo: event.target.value })
                              }
                            />
                            <input
                              className="input"
                              type="text"
                              maxLength={80}
                              placeholder="Student name"
                              aria-label={`Name for the student added to ${bus.route}`}
                              value={addForm.name}
                              onChange={(event) =>
                                setAddForm({ ...addForm, name: event.target.value })
                              }
                            />
                            <select
                              className="input tr-route-add-class"
                              aria-label="Class for the new student"
                              value={
                                addForm.grade && addForm.section
                                  ? `${addForm.grade}:${addForm.section}`
                                  : ''
                              }
                              onChange={(event) => {
                                const [grade, section] = event.target.value.split(':')
                                setAddForm({ ...addForm, grade: grade || '', section: section || '' })
                              }}
                            >
                              <option value="">Class</option>
                              {sectionOptions.map((option) => (
                                <option
                                  key={`${option.grade}:${option.section}`}
                                  value={`${option.grade}:${option.section}`}
                                >
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="tap"
                              disabled={addBusy}
                              onClick={() => addStudent(bus)}
                            >
                              {addBusy ? 'Adding…' : `Add to ${bus.route}`}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })
        )}
      </ExcelSheet>
    </>
  )
}
