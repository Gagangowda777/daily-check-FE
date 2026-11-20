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
import AnnouncementBoard from '../components/AnnouncementBoard.jsx'
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
  { id: 'announcement', label: 'Announcement', href: routeHref('leader/announcement') },
  { id: 'inbox', label: 'Inbox', href: routeHref('leader/inbox') },
]

const PAGE_META = {
  overview: { title: 'Class overview', subtitle: 'Your section at a glance' },
  inbox: { title: 'Inbox', subtitle: 'Read messages from the class teacher' },
  register: { title: 'Class register', subtitle: 'Today’s attendance for your section' },
  exit: { title: 'Exit restrictions', subtitle: 'Who cannot leave, and where each one stands' },
  buses: { title: 'Late bus arrivals', subtitle: 'Students whose bus reached after the cut-off' },
  entry: { title: 'Entry checks', subtitle: 'Subjects still pending with the class teacher' },
  nc: { title: 'NC & daily check', subtitle: 'NC tracker and today’s close status' },
  trend: { title: 'Trend', subtitle: 'Attendance, buses and exits over the last days' },
  announcement: { title: 'Announcement', subtitle: 'Announcements from the school, view only' },
}

const DATE_PAGES = ['register', 'exit', 'buses', 'entry', 'trend']

const todayIso = () => new Date().toLocaleDateString('en-CA')

export default function LeaderDashboard({ session, route, onSignOut }) {
  const { grade, section } = session
  const page = pageFor(route, 'leader', 'overview')
  const meta = PAGE_META[page] || PAGE_META.overview

  const today = todayIso()
  const [date, setDate] = useState(today)
  const [version, setVersion] = useState(0)
  const [state, setState] = useState({ key: '', data: null })
  const [error, setError] = useState('')

  const key = `${grade}:${section}:${date}:${version}`
  const data = state.data

  useEffect(() => {
    let alive = true
    api
      .leaderToday({ grade, section, date })
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
  }, [grade, section, date, key])

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
      onSignOut={onSignOut}
    >
      <div className="leader-body">
        {DATE_PAGES.includes(page) ? (
          <section className="control-bar">
            <div className="control-row">
              <div className="date-field">
                <input
                  className="date-input"
                  type="date"
                  value={date}
                  max={today}
                  aria-label="Report date"
                  onChange={(event) => setDate(event.target.value || today)}
                />
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setDate(today)}
                  disabled={date === today}
                >
                  Today
                </button>
              </div>
            </div>
          </section>
        ) : null}
        {error ? <div className="banner">{error}</div> : null}

        {page === 'inbox' ? (
          <LeaderInbox grade={grade} section={section} onChanged={refresh} />
        ) : page === 'register' ? (
          <LeaderRegister grade={grade} section={section} date={date} version={version} />
        ) : page === 'exit' ? (
          <LeaderExit data={data} />
        ) : page === 'buses' ? (
          <LeaderBuses data={data} />
        ) : page === 'entry' ? (
          <LeaderEntry data={data} />
        ) : page === 'nc' ? (
          <LeaderNc data={data} />
        ) : page === 'trend' ? (
          <LeaderTrend grade={grade} section={section} date={date} version={version} />
        ) : page === 'announcement' ? (
          <AnnouncementBoard readOnly />
        ) : (
          <LeaderOverview data={data} />
        )}
      </div>
    </Shell>
  )
}
