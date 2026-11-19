import { ExcelSheet } from '../../components/ExcelSheet.jsx'

const EXIT_TONE = {
  pending: 'is-pending',
  acknowledged: 'is-late',
  absent: '',
  excused: 'is-late',
  resolved: 'is-ok',
}

// The leader monitors exit restrictions; the class teacher performs the
// acknowledge/excuse/resolve actions.
export default function LeaderExit({ data }) {
  const open = data.exit.filter((row) => ['pending', 'acknowledged'].includes(row.status))

  return (
    <ExcelSheet
      title="Exit restrictions"
      meta={`${data.exit.length} flagged · ${open.length} open`}
      columns={['Sl. no.', 'Roll no', 'Student', 'Reason', 'Status', 'Duration', 'Teacher action']}
    >
      {data.exit.length === 0 ? (
        <tr>
          <td className="xls-empty" colSpan={7}>
            Nobody in this section is restricted from exiting today.
          </td>
        </tr>
      ) : (
        data.exit.map((row, index) => (
          <tr key={row.rollNo} className="xls-row">
            <td className="xls-no">{index + 1}</td>
            <td className="xls-time">{row.rollNo}</td>
            <td className="xls-name">{row.name}</td>
            <td>
              {row.reason}
              {row.note ? <span className="xls-sub-text">{row.note}</span> : null}
            </td>
            <td>
              <span className={`xls-badge ${EXIT_TONE[row.status] || ''}`.trim()}>{row.status}</span>
            </td>
            <td>{row.untilResolved ? 'Until resolved' : row.endDate || 'Today'}</td>
            <td>
              {row.acknowledgedBy ? (
                <>
                  <span className="xls-badge is-ok">Acknowledged</span>
                  <span className="xls-sub-text">
                    {row.acknowledgedBy} · {row.acknowledgedAt}
                  </span>
                </>
              ) : (
                <span className="xls-badge is-pending">Not acknowledged</span>
              )}
            </td>
          </tr>
        ))
      )}
    </ExcelSheet>
  )
}
