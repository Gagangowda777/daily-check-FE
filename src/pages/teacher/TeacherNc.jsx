// The NC count and the NE update live on the overview card; this screen only
// lists the students who carry an NC on the chosen date.
export default function TeacherNc({ data }) {
  const ncStudents = Array.isArray(data.nc.students)
    ? data.nc.students
    : (data.attendance?.rows || []).filter((row) => row.ncFlag)

  return (
    <section className="t-card">
      <div className="t-card-head">
        <h2>Students with an NC on this date</h2>
        <span className={`t-count${ncStudents.length ? ' is-alert' : ' is-ok'}`}>
          {ncStudents.length}
        </span>
      </div>
      <div className="t-body">
        {ncStudents.length === 0 ? (
          <p className="t-row-sub">No student carries an NC on this date.</p>
        ) : (
          <ul className="nc-students">
            {ncStudents.map((student) => (
              <li key={student.rollNo}>
                <strong>{student.name}</strong>
                <span className="nc-student-meta">
                  {student.rollNo} · {student.ncCount || 1} NC
                  {student.ncCount === 1 ? '' : 's'} ·{' '}
                  {student.ncReason || 'Delayed arrival'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
