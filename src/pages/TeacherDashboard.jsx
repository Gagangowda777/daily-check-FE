import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { pageFor, routeHref } from '../lib/router.js'
import Shell from '../components/Shell.jsx'
import TeacherAdminData from './teacher/TeacherAdminData.jsx'
import TeacherAttendance from './teacher/TeacherAttendance.jsx'
import TeacherBuses from './teacher/TeacherBuses.jsx'
import TeacherInbox from './teacher/TeacherInbox.jsx'
import TeacherNc from './teacher/TeacherNc.jsx'
import TeacherOverview from './teacher/TeacherOverview.jsx'
import InboxHub from '../components/InboxHub.jsx'
import AnnouncementBoard from '../components/AnnouncementBoard.jsx'
import '../teacher.css'

const TEACHER_NAV = [
  { id: 'overview', label: 'Overview', href: routeHref('teacher/overview') },
  { id: 'attendance', label: 'Attendance', href: routeHref('teacher/attendance') },
  { id: 'admin-data', label: 'Admin data', href: routeHref('teacher/admin-data') },
  { id: 'buses', label: 'Late bus arrivals', href: routeHref('teacher/buses') },
  { id: 'nc', label: 'NC tracker', href: routeHref('teacher/nc') },
  { id: 'inbox', label: 'Inbox', href: routeHref('teacher/inbox') },
]

const DATE_PAGES = ['attendance', 'admin-data', 'buses', 'nc']

const todayIso = () => new Date().toLocaleDateString('en-CA')

const PAGE_META = {
  overview: { title: 'Overview', subtitle: 'Your section at a glance' },
  attendance: { title: 'Attendance', subtitle: 'Present, absent or late. Absences carry forward' },
  'admin-data': { title: 'Admin data', subtitle: 'Announce and acknowledge the coordinator’s upload' },
  buses:{ title: 'Late bus arrivals', subtitle: 'Students whose bus reached after the cut-off' },
  nc: { title: 'NC tracker', subtitle: 'Daily NC count and NE update' },
  announcement: { title: 'Announcement', subtitle: 'Announcements for the school' },
  inbox: {
    title: 'Inbox',
    subtitle: 'Chats, archived broadcast snapshots and announcements',
  },
}

export default function TeacherDashboard({ session, route, onSignOut }) {
  const { grade, section } = session
  const requestedPage = pageFor(route, 'teacher', 'overview')
  const page = ['exit', 'entry'].includes(requestedPage) ? 'overview' : requestedPage
  const meta = PAGE_META[page] || PAGE_META.overview

  const today = todayIso()
  const [date, setDate] = useState(today)
  const [version, setVersion] = useState(0)
  const [state, setState] = useState({ key: '', data: null })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')

  const key = `${grade}:${section}:${date}:${version}`
  const data = state.data

  useEffect(() => {
    let alive = true
    api
      .teacherToday({ grade, section, date })
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

  const refresh = (message) => {
    if (message) setNotice(message)
    setVersion((value) => value + 1)
  }

  // Resolves true when the action succeeded, so inline forms can stay open
  // (and keep what was typed) when the API rejects the change.
  const run = async (id, action, message) => {
    setBusy(id)
    setError('')
    setNotice('')
    try {
      await action()
      refresh(message)
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusy('')
    }
  }

  if (!data) {
    return (
      <Shell
        user={{ name: session.sectionLabel || 'Class Teacher', role: 'Class Teacher' }}
        nav={TEACHER_NAV}
        activeNav={page}
        crumb="Class teacher"
        title={meta.title}
        subtitle="Loading today’s overview…"
        onSignOut={onSignOut}
      >
        <div className="teacher-body">
          {error ? (
            <>
              <div className="banner">{error}</div>
              <button type="button" className="tap" onClick={() => setVersion((value) => value + 1)}>
                Try again
              </button>
            </>
          ) : (
            <p className="empty">Loading today’s overview…</p>
          )}
        </div>
      </Shell>
    )
  }

  return (
    <Shell
      user={{ name: data.teacher, role: `${data.label} · Class Teacher` }}
      nav={TEACHER_NAV}
      activeNav={page}
      crumb={`Class teacher · ${data.label}`}
      title={page === 'overview' ? `${data.label} overview` : meta.title}
      subtitle={`${data.date} · ${meta.subtitle}`}
      onSignOut={onSignOut}
    >
      <div className="teacher-body">
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
        {notice ? (
          <p className="action-notice" role="status">
            {notice}
          </p>
        ) : null}

        {page === 'attendance' ? (
          <TeacherAttendance
            data={data}
            grade={grade}
            section={section}
            date={date}
            busy={busy}
            run={run}
          />
        ) : page === 'admin-data' ? (
          <TeacherAdminData
            data={data}
            grade={grade}
            section={section}
            date={date}
            busy={busy}
            run={run}
          />
        ) : page === 'buses' ? (
          <TeacherBuses data={data} />
        ) : page === 'nc' ? (
          <TeacherNc data={data} />
        ) : page === 'inbox' || page === 'message' ? (
          <InboxHub readTracking>
            <TeacherInbox grade={grade} section={section} onSent={refresh} />
          </InboxHub>
        ) : page === 'announcement' ? (
          <AnnouncementBoard readOnly />
        ) : (
          <TeacherOverview data={data} />
        )}
      </div>
    </Shell>
  )
}
