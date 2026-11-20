import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { pageFor, routeHref } from '../lib/router.js'
import Shell from '../components/Shell.jsx'
import LeaderBuses from './leader/LeaderBuses.jsx'
import LeaderEntry from './leader/LeaderEntry.jsx'
import LeaderExit from './leader/LeaderExit.jsx'
import LeaderInbox from './leader/LeaderInbox.jsx'
import LeaderNc from './leader/LeaderNc.jsx'
import LeaderOverview from './leader/LeaderOverview.jsx'
import LeaderRegister from './leader/LeaderRegister.jsx'
import LeaderTrend from './leader/LeaderTrend.jsx'
import '../teacher.css'
import '../leader.css'

const NAV = [
  { id: 'overview', label: 'Overview', href: routeHref('leader/overview') },
  { id: 'register', label: 'Class register', href: routeHref('leader/register') },
  { id: 'exit', label: 'Exit restrictions', href: routeHref('leader/exit') },
  { id: 'buses', label: 'Late arrivals', href: routeHref('leader/buses') },
  { id: 'entry', label: 'Entry checks', href: routeHref('leader/entry') },
  { id: 'nc', label: 'NC & check', href: routeHref('leader/nc') },
  { id: 'trend', label: 'Trend', href: routeHref('leader/trend') },
  { id: 'inbox', label: 'Inbox', href: routeHref('leader/inbox') },
]

const PAGE_META = {
  overview: { title: 'Class overview', subtitle: 'your section at a glance' },
  inbox: { title: 'Inbox', subtitle: 'read messages from the class teacher' },
  register: { title: 'Class register', subtitle: 'today’s attendance for your section' },
  exit: { title: 'Exit restrictions', subtitle: 'who cannot leave, and where each one stands' },
  buses: { title: 'Late bus arrivals', subtitle: 'students whose bus reached after the cut-off' },
  entry: { title: 'Entry checks', subtitle: 'subjects still pending with the class teacher' },
  nc: { title: 'NC & daily check', subtitle: 'NC tracker and today’s close status' },
  trend: { title: 'Trend', subtitle: 'attendance, buses and exits over the last days' },
}

export default function LeaderDashboard({ session, route, onSignOut }) {
  const { grade, section } = session
  const page = pageFor(route, 'leader', 'overview')
  const meta = PAGE_META[page] || PAGE_META.overview

  const [version, setVersion] = useState(0)
  const [state, setState] = useState({ key: '', data: null })
  const [error, setError] = useState('')

  const key = `${grade}:${section}:${version}`
  const data = state.data

  useEffect(() => {
    let alive = true
    api
      .leaderToday({ grade, section })
      .then((payload) => {
        if (!alive) return
        setState({ key, data: payload })
        setError('')
      })
      .catch((err) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [grade, section, key])

  const refresh = () => setVersion((value) => value + 1)

  const nav = NAV.map((item) =>
    item.id === 'inbox' && data?.stats.unread
      ? { ...item, chip: String(data.stats.unread) }
      : item
  )

  const user = {
    name: data?.leader || session.name || 'Class Leader',
    role: data ? `${data.label} · Class Leader` : 'Class Leader',
  }

  if (!data) {
    return (
      <Shell
        user={user}
        nav={nav}
        activeNav={page}
        crumb="Class leader"
        title={meta.title}
        subtitle="Loading your section…"
        onSignOut={onSignOut}
      >
        <div className="leader-body">
          {error ? (
            <>
              <div className="banner">{error}</div>
              <button type="button" className="tap" onClick={refresh}>
                Try again
              </button>
            </>
          ) : (
            <p className="empty">Loading your section…</p>
          )}
        </div>
      </Shell>
    )
  }

  return (
    <Shell
      user={user}
      nav={nav}
      activeNav={page}
      crumb={`Class leader · ${data.label}`}
      title={page === 'overview' ? `${data.label} overview` : meta.title}
      subtitle={`${data.date} · ${meta.subtitle}`}
      actions={
        <div className="head-actions">
          <a className={`progress-chip${data.stats.unread ? ' is-alert' : ''}`} href={routeHref('leader/inbox')}>
            {data.stats.unread ? `${data.stats.unread} unread` : 'inbox clear'}
          </a>
        </div>
      }
      onSignOut={onSignOut}
    >
      <div className="leader-body">
        {error ? <div className="banner">{error}</div> : null}

        {page === 'inbox' ? (
          <LeaderInbox grade={grade} section={section} onChanged={refresh} />
        ) : page === 'register' ? (
          <LeaderRegister grade={grade} section={section} version={version} />
        ) : page === 'exit' ? (
          <LeaderExit data={data} />
        ) : page === 'buses' ? (
          <LeaderBuses data={data} />
        ) : page === 'entry' ? (
          <LeaderEntry data={data} />
        ) : page === 'nc' ? (
          <LeaderNc data={data} />
        ) : page === 'trend' ? (
          <LeaderTrend grade={grade} section={section} version={version} />
        ) : (
          <LeaderOverview data={data} />
        )}
      </div>
    </Shell>
  )
}
