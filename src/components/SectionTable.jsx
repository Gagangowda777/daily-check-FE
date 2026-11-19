import { useState } from 'react'
import { ExcelSheet } from './ExcelSheet.jsx'

const ENTRY_LABELS = {
  complete: 'Complete',
  'in-progress': 'In progress',
  pending: 'Pending',
}

const ENTRY_TONE = {
  complete: 'is-ok',
  'in-progress': 'is-late',
  pending: 'is-pending',
}

const ACK_LABELS = {
  yes: 'Yes',
  partial: 'Partial',
  no: 'No',
  'no-messages': 'No messages',
}

const ACK_TONE = {
  yes: 'is-ok',
  partial: 'is-late',
  no: 'is-pending',
  'no-messages': '',
}

export default function SectionTable({ sections, loading }) {
  const [onlyFollowUp, setOnlyFollowUp] = useState(false)

  const rows = onlyFollowUp ? sections.filter((row) => row.needsFollowUp) : sections
  const followUpCount = sections.filter((row) => row.needsFollowUp).length

  const toolbar = (
    <label className="toggle">
      <input
        type="checkbox"
        checked={onlyFollowUp}
        onChange={(event) => setOnlyFollowUp(event.target.checked)}
      />
      Not responded only
    </label>
  )

  return (
    <ExcelSheet
      title="Section progress"
      meta={
        loading
          ? 'Loading…'
          : `${rows.length} sections · ${followUpCount} need follow-up`
      }
      toolbar={toolbar}
      columns={[
        'Sl. no.',
        'Section',
        'Class teacher',
        'Exit check',
        'Entry check',
        'Daily NC',
        'Leader read',
      ]}
    >
      {loading ? (
        <tr>
          <td className="xls-empty" colSpan={7}>
            Loading sections…
          </td>
        </tr>
      ) : rows.length === 0 ? (
        <tr>
          <td className="xls-empty" colSpan={7}>
            All sections have responded — nothing waiting on a teacher.
          </td>
        </tr>
      ) : (
        rows.map((row, index) => (
          <tr
            key={`${row.grade}${row.section}`}
            className={`xls-row${row.needsFollowUp ? ' is-late' : ''}`}
          >
            <td className="xls-no">{index + 1}</td>
            <td className="xls-route">{row.label}</td>
            <td className="xls-name">{row.teacher}</td>

            <td>
              {row.exit.pending} pending · {row.exit.acknowledged} read
              <span className={`xls-badge ${row.exit.done ? 'is-ok' : 'is-pending'}`}>
                {row.exit.done ? 'Done' : 'Not responded'}
              </span>
            </td>

            <td>
              <span className={`xls-badge ${ENTRY_TONE[row.entry.status] || ''}`.trim()}>
                {ENTRY_LABELS[row.entry.status]}
              </span>
            </td>

            <td>
              {row.nc.count === null ? 'Not entered' : `${row.nc.count} NC`}
              <span className={`xls-badge ${row.nc.updatedInNe ? 'is-ok' : 'is-pending'}`}>
                NE {row.nc.updatedInNe ? 'Yes' : 'No'}
              </span>
            </td>

            <td>
              <span className={`xls-badge ${ACK_TONE[row.leaderAck.status] || ''}`.trim()}>
                {ACK_LABELS[row.leaderAck.status]}
              </span>
            </td>
          </tr>
        ))
      )}
    </ExcelSheet>
  )
}
