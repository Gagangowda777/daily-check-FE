import { ExcelSheet } from '../../components/ExcelSheet.jsx'

export default function LeaderEntry({ data }) {
  const handedOver = data.entry.filter((row) => row.handover)

  return (
    <ExcelSheet
      title="Entry checks"
      meta={`${data.entry.length} pending · ${handedOver.length} with admin`}
      note="Entry restrictions stay open until the class teacher clears the subjects with the teacher concerned."
      columns={['Sl. no.', 'Roll no', 'Student', 'Pending subjects', 'Status']}
    >
      {data.entry.length === 0 ? (
        <tr>
          <td className="xls-empty" colSpan={5}>
            All entry checks are closed for this section.
          </td>
        </tr>
      ) : (
        data.entry.map((row, index) => (
          <tr key={row.rollNo} className="xls-row">
            <td className="xls-no">{index + 1}</td>
            <td className="xls-time">{row.rollNo}</td>
            <td className="xls-name">{row.name}</td>
            <td>
              {row.subjects.length ? (
                <div className="xls-students">
                  {row.subjects.map((subject) => (
                    <span key={subject} className="xls-student">
                      {subject}
                    </span>
                  ))}
                </div>
              ) : (
                'No pending subjects recorded'
              )}
            </td>
            <td>
              {row.handover ? (
                <>
                  <span className="xls-badge is-late">Sent to admin</span>
                  {row.handoverAt ? <span className="xls-sub-text">{row.handoverAt}</span> : null}
                </>
              ) : (
                <span className="xls-badge is-pending">With class teacher</span>
              )}
            </td>
          </tr>
        ))
      )}
    </ExcelSheet>
  )
}
