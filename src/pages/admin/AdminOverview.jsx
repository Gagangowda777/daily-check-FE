import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import ActionBar from '../../components/ActionBar.jsx'
import KpiCards from '../../components/KpiCards.jsx'

// Overview keeps only the live counters and the quick actions, so the page
// reads as one screen instead of a scroll through every module.
export default function AdminOverview({ date, grade, section, reload, onChanged }) {
  const [state, setState] = useState({ key: '', kpi: null })
  const key = `${date}|${grade}|${section}|${reload}`

  useEffect(() => {
    let alive = true
    api
      .kpi({ date, grade, section })
      .then((kpi) => {
        if (alive) setState({ key, kpi })
      })
      .catch((err) => {
        if (alive) setState({ key, kpi: null, error: err.message })
      })
    return () => {
      alive = false
    }
  }, [date, grade, section, key])

  const loading = state.key !== key

  return (
    <div className="content">
      {state.error ? <div className="banner">{state.error}</div> : null}

      <ActionBar date={date} onCreated={onChanged} />

      <KpiCards kpi={loading ? null : state.kpi} />
    </div>
  )
}
