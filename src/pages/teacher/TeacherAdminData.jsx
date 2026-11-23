import { api } from '../../lib/api.js'
import { ExcelSheet } from '../../components/ExcelSheet.jsx'

// The coordinator enters the day's restrictions in the admin Data entry
// screen. The class teacher reads them out in class, acknowledges receipt of
// exactly that upload, and ticks each student off one row at a time.

export default function TeacherAdminData({ data, grade, section, date, busy, run }) {
  const admin = data.adminData || { rows: [] }
  const rows = admin.rows || []
  // The announcement covers the exact upload; a later admin edit needs a
  // fresh announcement and acknowledgement.
  const announced = Boolean(admin.announcedAt) && (admin.announcedCount || 0) === rows.length
  const acknowledged =
    announced && Boolean(admin.acknowledgedAt) && (admin.acknowledgedCount || 0) === rows.length

  return (
    <div className="t-stack">
      <section className="t-card">
        <div className="t-card-head">
          <h2>Admin upload for {data.label}</h2>
          <span
            className={`t-count${acknowledged ? ' is-ok' : announced ? ' is-alert' : ''}`}
          >
            {acknowledged ? 'Acknowledged' : announced ? 'Announced' : `${rows.length} to announce`}
          </span>
        </div>
        <div className="t-body">
          <p className="t-row-sub">
            Announce the uploaded rows to the class first, then acknowledge that you have
            received and read them out.
          </p>
          <div className="t-actions">
            <button
              type="button"
              className="tap"
              disabled={rows.length === 0 || announced || busy === 'admin-announce'}
              onClick={() =>
                run(
                  'admin-announce',
                  () => api.teacherAnnounceAdmin({ grade, section, date }),
                  'Announced to the class.'
                )
              }
            >
              {busy === 'admin-announce' ? 'Saving…' : '1. Announce in class'}
            </button>
            <button
              type="button"
              className="tap is-good"
              disabled={!announced || acknowledged || busy === 'admin-ack'}
              title={announced ? 'Acknowledge the upload' : 'Announce it in class first'}
              onClick={() =>
                run(
                  'admin-ack',
                  () => api.teacherAckAdmin({ grade, section, date }),
                  'Admin upload acknowledged.'
                )
              }
            >
              {busy === 'admin-ack' ? 'Saving…' : '2. Acknowledge upload'}
            </button>
          </div>
          <p className="t-row-sub">
            {announced
              ? `Announced at ${admin.announcedAt}${admin.announcedBy ? ` by ${admin.announcedBy}` : ''}.`
              : admin.announcedAt
                ? 'The admin upload changed since you announced it. Announce the new rows again.'
                : 'Not announced yet.'}
            {acknowledged
              ? ` Acknowledged at ${admin.acknowledgedAt}${admin.acknowledgedBy ? ` by ${admin.acknowledgedBy}` : ''}.`
              : ''}
          </p>
          {rows.length === 0 ? (
            <p className="t-row-sub">The admin has not uploaded any rows for this section on this date.</p>
          ) : null}
        </div>
      </section>

      <ExcelSheet
        title="Uploaded rows"
        meta={`${rows.length} row${rows.length === 1 ? '' : 's'}`}
        note="Rows the coordinator uploaded for this date. Status names the latest admin message sent to this class."
        columns={['Sl. no.', 'Type', 'Roll no', 'Student', 'Uploaded detail', 'Status']}
      >
        {rows.length === 0 ? (
          <tr>
            <td className="xls-empty" colSpan={6}>
              Nothing uploaded by the admin today.
            </td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr key={`${row.type}-${row.rollNo}`} className="xls-row">
              <td className="xls-no">{index + 1}</td>
              <td>
                <span className={`xls-badge ${row.type === 'exit' ? 'is-late' : 'is-blue'}`}>
                  {row.type === 'exit' ? 'Exit' : 'Entry'}
                </span>
              </td>
              <td className="xls-time">{row.rollNo}</td>
              <td className="xls-name">{row.name}</td>
              <td>{row.detail}</td>
              <td>
                <span className="xls-badge is-blue">{row.category || '—'}</span>
              </td>
            </tr>
          ))
        )}
      </ExcelSheet>
    </div>
  )
}
