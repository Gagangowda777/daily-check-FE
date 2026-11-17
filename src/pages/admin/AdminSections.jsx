import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import SectionTable from '../../components/SectionTable.jsx'

// Every section at a glance: exit checks, entry checks, NC tracker and
// leader acknowledgements, with a "needs follow-up" filter.
export default function AdminSections({ date, grade, section, reload }) {
  const [state, setState] = useState({ key: '', rows: [] })
  const [error, setError] = useState('')
  const key = `${date}|${grade}|${section}|${reload}`

  useEffect(() => {
    let alive = true
    api
      .sections({ date, grade, section })
      .then((payload) => {
        if (alive) setState({ key, rows: payload.rows })
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [date, grade, section, key])

  return (
    <div className="content">
      {error ? <div className="banner">{error}</div> : null}
      <SectionTable sections={state.rows} loading={state.key !== key} />
    </div>
  )
}
