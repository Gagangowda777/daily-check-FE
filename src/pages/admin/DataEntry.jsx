import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api.js'
import { ExcelSheet } from '../../components/ExcelSheet.jsx'
import '../../components/excel.css'
import '../../dataentry.css'

// The coordinator's data-entry screen. Each tab is one sheet of the daily-check
// workbook, with the same columns, so the day's data is typed once here and the
// register, gate and dashboards read it back.
const TABS = [
  { id: 'exit', label: '1. Exit Restriction' },
  { id: 'entry', label: '2. Entry Restriction' },
  { id: 'nc', label: '3. CC NC Digital' },
  { id: 'bus', label: '4. Bus Log' },
]

const STATUSES = [
  { id: 'pending', label: 'Pending' },
  { id: 'acknowledged', label: 'Acknowledged' },
  { id: 'absent', label: 'Absent' },
  { id: 'excused', label: 'Excused' },
  { id: 'resolved', label: 'Resolved' },
]

const PU1_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'HA']
const PU2_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']

const classLabelOf = (grade, section) => `${grade === 'PU1' ? '11' : '12'}${section}`
const prettyDate = (iso) => String(iso || '').split('-').reverse().join('/')

const previousDayOf = (iso) => {
  const when = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(when.getTime())) return ''
  when.setUTCDate(when.getUTCDate() - 1)
  return when.toISOString().slice(0, 10)
}

// Arrival times are typed, not picked: "8:18", "08:18" and "0818" all become 08:18.
const normalizeTime = (raw) => {
  const match = String(raw || '')
    .trim()
    .match(/^(\d{1,4})[:.]?(\d{0,2})$/)
  if (!match) return ''
  let hours
  let minutes
  if (match[2] === '') {
    if (match[1].length !== 4) return ''
    hours = Number(match[1].slice(0, 2))
    minutes = Number(match[1].slice(2))
  } else {
    hours = Number(match[1])
    minutes = Number(match[2])
  }
  if (hours > 23 || minutes > 59) return ''
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}
const emptyExit = () => ({ key: `new-${Date.now()}-${Math.random()}`, rollNo: '', name: '', classLabel: '', reason: '', status: 'pending', saved: false })
const emptyEntry = () => ({ key: `new-${Date.now()}-${Math.random()}`, rollNo: '', name: '', classLabel: '', subjects: '', saved: false })

// Rows saved from this screen sit at the bottom of the sheet, matching the
// order of a workbook where new entries are added under the last line.
const savedRowsLast = (rows, rolls = []) => {
  if (!rolls.length) return rows
  const last = new Set(rolls)
  return [...rows.filter((row) => !last.has(row.rollNo)), ...rows.filter((row) => last.has(row.rollNo))]
}

export default function DataEntry({ date }) {
  const [tab, setTab] = useState('exit')
  const [exitRows, setExitRows] = useState([])
  const [entryRows, setEntryRows] = useState([])
  const [ncValues, setNcValues] = useState({})
  const [buses, setBuses] = useState([])
  const [busTimes, setBusTimes] = useState({})
  const [removed, setRemoved] = useState({ exit: [], entry: [] })
  const [loadedKey, setLoadedKey] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [repeats, setRepeats] = useState(null)
  const skipDirty = useRef(true)
  const freshRolls = useRef({ exit: [], entry: [] })

  useEffect(() => {
    if (skipDirty.current) {
      skipDirty.current = false
      return
    }
    setDirty(true)
  }, [exitRows, entryRows, ncValues])

  const load = async (fresh = false) => {
    const [sheet, transport] = await Promise.all([
      api.dataEntry(date),
      api.transportToday({ date }),
    ])

    skipDirty.current = true
    setDirty(false)
    setExitRows(
      savedRowsLast(
        (sheet.exit || []).map((row) => ({
          key: row.rollNo,
          rollNo: row.rollNo,
          name: row.name,
          classLabel: row.classLabel,
          reason: row.restrictionReason || '',
          status: row.status || 'pending',
          saved: true,
        })),
        freshRolls.current.exit
      )
    )
    setEntryRows(
      savedRowsLast(
        (sheet.entry || []).map((row) => ({
          key: row.rollNo,
          rollNo: row.rollNo,
          name: row.name,
          classLabel: row.classLabel,
          subjects: row.subjects || '',
          saved: true,
        })),
        freshRolls.current.entry
      )
    )
    setNcValues(
      Object.fromEntries(
        (sheet.nc || []).map((row) => [
          `${row.grade}:${row.section}`,
          { count: String(row.count ?? ''), updatedInNe: Boolean(row.updatedInNe) },
        ])
      )
    )
    setBuses(transport.routes || [])
    setBusTimes(
      Object.fromEntries((transport.routes || []).map((route) => [route.route, route.arrivalTime || '']))
    )
    setRemoved({ exit: [], entry: [] })
    setLoadedKey(date)
    if (fresh) {
      setNotice('')
      setError('')
    }
  }

  useEffect(() => {
    let alive = true
    Promise.resolve()
      .then(() => load(true))
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  const refresh = async () => {
    try {
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const loading = loadedKey !== date

  // ---- shared row helpers ------------------------------------------------

  const lookup = async (index, rawRoll, setList) => {
    const norm = rawRoll.trim().toUpperCase()
    if (norm.length < 4) return

    try {
      const res = await api.student(norm)
      const student = res?.student
      if (!student) return
      setList((current) =>
        current.map((row, i) =>
          i === index && row.rollNo.trim().toUpperCase() === norm
            ? { ...row, name: student.name, classLabel: classLabelOf(student.grade, student.section) }
            : row
        )
      )
    } catch {
      setList((current) =>
        current.map((row, i) => (i === index ? { ...row, name: 'Not on roster', classLabel: '' } : row))
      )
    }
  }

  const patch = (setList, index, values) =>
    setList((current) => current.map((row, i) => (i === index ? { ...row, ...values } : row)))

  const dropRow = (list, setList, sheet, index) => {
    const row = list[index]
    if (row?.saved && row.rollNo) {
      setRemoved((current) => ({ ...current, [sheet]: [...current[sheet], row.rollNo] }))
    }
    setList((current) => current.filter((_, i) => i !== index))
  }

  // ---- saves -------------------------------------------------------------

  const saveRestrictions = async (sheet) => {
    const isExit = sheet === 'exit'
    const list = isExit ? exitRows : entryRows
    const rows = list
      .filter((row) => row.rollNo.trim())
      .map((row) =>
        isExit
          ? { rollNo: row.rollNo.trim().toUpperCase(), reason: row.reason.trim(), status: row.status }
          : { rollNo: row.rollNo.trim().toUpperCase(), subjects: row.subjects.trim() }
      )

    if (rows.length === 0 && removed[sheet].length === 0) {
      setError('Add at least one row to the sheet first.')
      return
    }

    const addedRolls = list
      .filter((row) => !row.saved && row.rollNo.trim())
      .map((row) => row.rollNo.trim().toUpperCase())

    setBusy(sheet)
    setError('')
    setNotice('')
    try {
      const res = await api.saveDataEntry({ date, sheet, rows, removed: removed[sheet] })
      freshRolls.current = {
        ...freshRolls.current,
        [sheet]: [...new Set([...freshRolls.current[sheet], ...addedRolls])],
      }
      setNotice(
        `${res.saved} row${res.saved === 1 ? '' : 's'} saved to the register for ${prettyDate(date)}.`
      )
      if (res.repeats?.length) {
        setRepeats({
          sheet: sheet === 'exit' ? 'exit restriction' : 'entry restriction',
          date: previousDayOf(date),
          items: res.repeats,
        })
      } else {
        setRepeats(null)
      }
      if (res.errors?.length) {
        setError(
          `Skipped ${res.errors.length} row(s): ` +
            res.errors.map((item) => `${item.rollNo}: ${item.error}`).join('; ')
        )
      }
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const saveNc = async () => {
    const rows = [
      ...PU1_SECTIONS.map((section) => ({ grade: 'PU1', section })),
      ...PU2_SECTIONS.map((section) => ({ grade: 'PU2', section })),
    ].map((row) => {
      const value = ncValues[`${row.grade}:${row.section}`] || {}
      return {
        ...row,
        count: Number(value.count) || 0,
        updatedInNe: Boolean(value.updatedInNe),
      }
    })

    setBusy('nc')
    setError('')
    setNotice('')
    try {
      const res = await api.saveNcSheet({ date, rows })
      setNotice(`${res.saved} section row${res.saved === 1 ? '' : 's'} saved for ${prettyDate(date)}.`)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const logArrival = async (route, raw = busTimes[route]) => {
    const time = normalizeTime(raw)
    if (!time) {
      setError(`Enter a valid arrival time for ${route}, e.g. 08:18.`)
      return
    }
    setBusTimes((current) => ({ ...current, [route]: time }))
    setBusy(route)
    setError('')
    setNotice('')
    try {
      const res = await api.transportArrive(route, { date, time })
      setNotice(`${route} arrival saved at ${time}, ${res.late ? 'late' : 'not late'} (cut-off ${res.cutoff}).`)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const setNc = (grade, section, values) =>
    setNcValues((current) => ({
      ...current,
      [`${grade}:${section}`]: { ...(current[`${grade}:${section}`] || {}), ...values },
    }))

  return (
    <div className="de-wrap">
      {notice ? <div className="de-notice">{notice}</div> : null}
      {error ? <div className="banner">{error}</div> : null}

      <div className="de-sheet">
        <div className="de-tabs" role="tablist" aria-label="Workbook sheets">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`de-tab${tab === item.id ? ' is-active' : ''}`}
            onClick={() => {
              setTab(item.id)
              setNotice('')
              setError('')
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

        {loading ? <p className="de-loading">Loading the sheets…</p> : null}

      {!loading && tab === 'exit' ? (
        <ExcelSheet
          reserveHeader
          meta={`${exitRows.length} row${exitRows.length === 1 ? '' : 's'}`}
          columns={[
            'Sl. No.',
            'SEC',
            'RN',
            'NAME',
            'REASON',
            { key: 'status', label: 'Status' },
            { key: 'del', label: '' },
          ]}
          toolbar={
            <div className="de-actions">
              <button type="button" className="de-btn" onClick={() => setExitRows([emptyExit(), ...exitRows])}>
                + Add row
              </button>
            </div>
          }
        >
          {exitRows.length === 0 ? (
            <tr>
              <td className="xls-empty" colSpan={7}>
                No exit restrictions on this date. Use “Add row” to type one.
              </td>
            </tr>
          ) : (
            exitRows.map((row, index) => (
              <tr key={row.key} className="xls-row">
                <td className="xls-no">{index + 1}</td>
                <td className="de-sec">{row.classLabel || '-'}</td>
                <td>
                  <input
                    className="de-input is-roll"
                    value={row.rollNo}
                    placeholder="26A141"
                    onChange={(event) => patch(setExitRows, index, { rollNo: event.target.value })}
                    onBlur={(event) => lookup(index, event.target.value, setExitRows)}
                  />
                </td>
                <td className="xls-name">{row.name || '-'}</td>
                <td>
                  <input
                    className="de-input"
                    value={row.reason}
                    placeholder="Crossed 3 NC's 16/11"
                    onChange={(event) => patch(setExitRows, index, { reason: event.target.value })}
                  />
                </td>
                <td>
                  <select
                    className={`de-input is-status st-${row.status}`}
                    value={row.status}
                    onChange={(event) => patch(setExitRows, index, { status: event.target.value })}
                  >
                    {STATUSES.map((status) => (
                      <option key={status.id} value={status.id}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="xls-actions">
                  <button
                    type="button"
                    className="de-del"
                    title="Remove row"
                    onClick={() => dropRow(exitRows, setExitRows, 'exit', index)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))
          )}
        </ExcelSheet>
      ) : null}

      {!loading && tab === 'entry' ? (
        <ExcelSheet
          reserveHeader
          meta={`${entryRows.length} row${entryRows.length === 1 ? '' : 's'}`}
          columns={['Sl. No.', 'Class', 'RN', 'Name', 'NOC Pending', { key: 'del', label: '' }]}
          toolbar={
            <div className="de-actions">
              <button type="button" className="de-btn" onClick={() => setEntryRows([emptyEntry(), ...entryRows])}>
                + Add row
              </button>
            </div>
          }
        >
          {entryRows.length === 0 ? (
            <tr>
              <td className="xls-empty" colSpan={6}>
                No pending entry NOCs on this date. Use “Add row” to type one.
              </td>
            </tr>
          ) : (
            entryRows.map((row, index) => (
              <tr key={row.key} className="xls-row">
                <td className="xls-no">{index + 1}</td>
                <td className="de-sec">{row.classLabel || '-'}</td>
                <td>
                  <input
                    className="de-input is-roll"
                    value={row.rollNo}
                    placeholder="26A131"
                    onChange={(event) => patch(setEntryRows, index, { rollNo: event.target.value })}
                    onBlur={(event) => lookup(index, event.target.value, setEntryRows)}
                  />
                </td>
                <td className="xls-name">{row.name || '-'}</td>
                <td>
                  <input
                    className="de-input"
                    value={row.subjects}
                    placeholder="BS, ECO, STATS"
                    onChange={(event) => patch(setEntryRows, index, { subjects: event.target.value })}
                  />
                </td>
                <td className="xls-actions">
                  <button
                    type="button"
                    className="de-del"
                    title="Remove row"
                    onClick={() => dropRow(entryRows, setEntryRows, 'entry', index)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))
          )}
        </ExcelSheet>
      ) : null}

      {!loading && tab === 'nc' ? (
        <div className="de-nc">
          {[
            { grade: 'PU1', sections: PU1_SECTIONS },
            { grade: 'PU2', sections: PU2_SECTIONS },
          ].map((group) => (
            <ExcelSheet
              key={group.grade}
              reserveHeader
              columns={['Section', 'NC Count', 'Updated in NE']}
            >
              {group.sections.map((section) => {
                const value = ncValues[`${group.grade}:${section}`] || {}
                return (
                  <tr key={section} className="xls-row">
                    <td className="de-sec">{classLabelOf(group.grade, section)}</td>
                    <td>
                      <input
                        className="de-input is-count"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={value.count ?? ''}
                        onChange={(event) => setNc(group.grade, section, { count: event.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        className="de-input is-status"
                        value={value.updatedInNe ? 'yes' : 'no'}
                        onChange={(event) => setNc(group.grade, section, { updatedInNe: event.target.value === 'yes' })}
                      >
                        <option value="no">Not set</option>
                        <option value="yes">Yes - CC</option>
                      </select>
                    </td>
                  </tr>
                )
              })}
            </ExcelSheet>
          ))}

        </div>
      ) : null}

      {!loading && tab === 'bus' ? (
        <ExcelSheet
          reserveHeader
          meta={`${buses.filter((bus) => bus.late).length} late route${buses.filter((bus) => bus.late).length === 1 ? '' : 's'}`}
          columns={['Sl. No.', 'Route', 'Arrival', 'Late / Not late', 'Students late on this route']}
        >
          {buses.length === 0 ? (
            <tr>
              <td className="xls-empty" colSpan={5}>
                No routes on the bus log for this date.
              </td>
            </tr>
          ) : (
            buses.map((bus, index) => (
              <tr key={bus.route} className={`xls-row ${bus.late ? 'is-late' : 'is-ok'}`}>
                <td className="xls-no">{index + 1}</td>
                <td className="xls-route">{bus.route}</td>
                <td>
                  <input
                    className="de-input is-roll"
                    type="text"
                    inputMode="text"
                    placeholder="HH:MM"
                    maxLength={5}
                    aria-label={`Arrival time for ${bus.route}`}
                    value={busTimes[bus.route] ?? ''}
                    disabled={busy === bus.route}
                    onChange={(event) => setBusTimes({ ...busTimes, [bus.route]: event.target.value })}
                    onBlur={(event) => {
                      const typed = event.target.value
                      if (normalizeTime(typed) !== normalizeTime(bus.arrivalTime)) {
                        logArrival(bus.route, typed)
                      } else {
                        setBusTimes({ ...busTimes, [bus.route]: normalizeTime(typed) })
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                    }}
                  />
                </td>
                <td>
                  {bus.arrivalTime ? (
                    <span className={`xls-badge ${bus.late ? 'is-late' : 'is-ok'}`}>
                      {bus.late ? 'Late' : 'Not late'}
                    </span>
                  ) : (
                    <span className="xls-badge is-pending">Not arrived</span>
                  )}
                </td>
                <td>
                  <span className="xls-count">
                    {bus.students?.filter((student) => student.busLate).length || 0} student
                    {(bus.students?.filter((student) => student.busLate).length || 0) === 1 ? '' : 's'}
                  </span>
                </td>
              </tr>
            ))
          )}
        </ExcelSheet>
      ) : null}
      </div>

      {!loading && tab !== 'bus' ? (
        <div className="de-savebar">
          <span className={`de-save-status${dirty ? ' is-dirty' : ''}`}>
            <span className="de-dot" aria-hidden="true" />
            {dirty ? 'Unsaved changes' : 'All changes saved'}
          </span>
          <button
            type="button"
            className="de-btn is-primary"
            disabled={busy === tab}
            onClick={() => (tab === 'nc' ? saveNc() : saveRestrictions(tab))}
          >
            {busy === tab ? 'Saving…' : tab === 'nc' ? 'Save NC sheet' : 'Save sheet'}
          </button>
        </div>
      ) : null}

      {repeats ? (
        <div
          className="de-modal"
          role="presentation"
          onClick={() => setRepeats(null)}
        >
          <div
            className="de-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Student appeared yesterday too"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="de-dialog-head">
              <h3>Appeared yesterday too</h3>
              <button
                type="button"
                className="de-dialog-close"
                aria-label="Close"
                onClick={() => setRepeats(null)}
              >
                ✕
              </button>
            </div>
            <p className="de-dialog-sub">
              {repeats.items.length} {repeats.items.length === 1 ? 'student is' : 'students are'} on
              the {repeats.sheet} sheet for both {prettyDate(repeats.date)} and{' '}
              {prettyDate(date)}. Check whether yesterday's row should still stand.
            </p>
            <ul className="de-repeat-list">
              {repeats.items.map((item) => (
                <li key={`${item.rollNo}-${item.date}`}>
                  <strong>{item.name}</strong>
                  <span className="de-repeat-meta">
                    {item.rollNo} · {item.classLabel}
                    {item.reason ? ` · ${item.reason}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <div className="de-dialog-actions">
              <button type="button" className="de-btn is-primary" onClick={() => setRepeats(null)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
