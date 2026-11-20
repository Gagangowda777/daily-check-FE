import { useState } from 'react'
import './excel.css'

// A compact, Excel-like sheet used by every dashboard so the daily sections
// (buses, exits, entries, register, trend) read the same way as the workbook.
export function ExcelSheet({
  title,
  note,
  meta,
  toolbar,
  reserveHeader = false,
  columns,
  children,
  className = '',
}) {
  const cols = columns.map((col) =>
    typeof col === 'string' ? { key: col, label: col } : { key: col.key || col.label, ...col }
  )

  return (
    <section className={`xls-card ${className}`.trim()}>
      {title || note || meta || toolbar || reserveHeader ? (
        <div className="xls-bar">
          <div className="xls-bar-text">
            {title ? <h2>{title}</h2> : null}
            {note ? <p className="xls-note">{note}</p> : null}
          </div>
          <div className="xls-bar-side">
            {meta ? <span className="xls-meta">{meta}</span> : null}
            {toolbar || null}
          </div>
        </div>
      ) : null}
      <div className="xls-scroll">
        <table className="xls-table">
          <thead>
            <tr>
              {cols.map((col) => (
                <th key={col.key} className={col.className || ''}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  )
}

const studentClass = (student) => student.classLabel || student.section || ''

// Long routes keep the sheet readable: the first few students stay visible and
// the rest sit behind a "More" toggle that expands the full list in place.
const STUDENTS_PREVIEW = 4

function LateStudents({ students = [], bus }) {
  const [expanded, setExpanded] = useState(false)
  if (students.length === 0) return null

  const hidden = Math.max(students.length - STUDENTS_PREVIEW, 0)
  const visible = expanded ? students : students.slice(0, STUDENTS_PREVIEW)

  return (
    <div className="xls-students">
      {visible.map((student) => (
        <span key={student.rollNo || student.name} className="xls-student">
          {studentClass(student) ? <em>{studentClass(student)}</em> : null}
          {student.name}
        </span>
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          className="xls-more"
          aria-expanded={expanded}
          aria-label={
            expanded
              ? `Show fewer students late on route ${bus.route || ''}`.trim()
              : `Show all ${students.length} students late on route ${bus.route || ''}`.trim()
          }
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? 'Less' : `More (${hidden})`}
          <span className="xls-more-caret" aria-hidden="true">
            {expanded ? '▲' : '▼'}
          </span>
        </button>
      ) : null}
    </div>
  )
}

export function BusArrivalsSheet({
  buses = [],
  title = 'Late bus arrivals',
  note,
  meta,
  toolbar,
  empty = 'No late buses today.',
  renderActions,
  actionLabel = 'Actions',
}) {
  const columns = ['Sl. no.', 'Route', 'Arrival', 'Late / Not late', 'Students late on this route']
  if (renderActions) columns.push(actionLabel)

  return (
    <ExcelSheet title={title} note={note} meta={meta} toolbar={toolbar} columns={columns}>
      {buses.length === 0 ? (
        <tr>
          <td className="xls-empty" colSpan={columns.length}>
            {empty}
          </td>
        </tr>
      ) : (
        buses.map((bus, index) => (
          <tr key={bus.route} className={`xls-row ${bus.late ? 'is-late' : 'is-ok'}`}>
            <td className="xls-no">{index + 1}</td>
            <td className="xls-route">{bus.route}</td>
            <td className="xls-time">{bus.arrivalTime || '-'}</td>
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
              {bus.students?.length ? (
                <LateStudents students={bus.students} bus={bus} />
              ) : (
                <span className="xls-count">
                  {bus.affectedStudents || 0} student{(bus.affectedStudents || 0) === 1 ? '' : 's'}
                </span>
              )}
            </td>
            {renderActions ? <td className="xls-actions">{renderActions(bus)}</td> : null}
          </tr>
        ))
      )}
    </ExcelSheet>
  )
}
