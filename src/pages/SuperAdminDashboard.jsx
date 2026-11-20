import { useState } from 'react'
import { pageFor, routeHref } from '../lib/router.js'
import Shell from '../components/Shell.jsx'
import SuperAdminApprovals from './superadmin/SuperAdminApprovals.jsx'
import SuperAdminReview from './superadmin/SuperAdminReview.jsx'
import ChatInbox from '../components/ChatInbox.jsx'
import InfoTip from '../components/InfoTip.jsx'
import '../dashboard.css'
import '../teacher.css'
import '../superadmin.css'

const NAV = [
  { id: 'approvals', label: 'Final approval', href: routeHref('superadmin/approvals') },
  { id: 'inbox', label: 'Inbox', href: routeHref('superadmin/inbox') },
]

const PAGE_META = {
  approvals: {
    title: 'Final approval',
    subtitle: 'sign off the admin uploads the class teachers have acknowledged',
  },
  review: { title: 'Section review', subtitle: 'the uploaded day for one section' },
  inbox: { title: 'Inbox', subtitle: 'chat with the admin, teachers and class leaders' },
}

const APPROVAL_HELP =
  'Every row the coordinator uploaded, once the class teacher has announced and acknowledged ' +
  'it, waits here for the super admin’s sign-off.'

const todayIso = () => new Date().toLocaleDateString('en-CA')

const formatDate = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

export default function SuperAdminDashboard({ session, route, onSignOut }) {
  const parts = route.split('/')
  const review =
    parts[1] === 'review' && parts[2] && parts[3]
      ? { grade: parts[2], section: parts[3], date: parts[4] || '' }
      : null
  const page = review ? 'review' : pageFor(route, 'superadmin', 'approvals')
  const [date, setDate] = useState(todayIso())
  const [query, setQuery] = useState('')
  const [grade, setGrade] = useState('ALL')
  const today = todayIso()
  const meta = review
    ? { ...PAGE_META.review, title: `${review.grade === 'PU1' ? '11' : '12'}${review.section} review` }
    : PAGE_META[page] || PAGE_META.approvals
  const reviewDate = review?.date || date
  const subtitle = (
    <span className="page-meta">
      <span>{`${formatDate(review ? reviewDate : date)} · ${meta.subtitle}`}</span>
      {page === 'approvals' && !review ? (
        <InfoTip label="How final approval works">{APPROVAL_HELP}</InfoTip>
      ) : null}
    </span>
  )

  return (
    <Shell
      user={{ name: 'Super Admin', role: session.email }}
      nav={NAV}
      activeNav={review ? 'approvals' : page}
      crumb="Super admin"
      title={meta.title}
      subtitle={subtitle}
      onSignOut={onSignOut}
    >
      {!review ? (
        <section className="control-bar">
          <div className="control-row">
            <div className="date-field">
              <input
                className="date-input"
                type="date"
                value={date}
                max={today}
                aria-label="Approval date"
                onChange={(event) => setDate(event.target.value || today)}
              />
              <button
                type="button"
                className="ghost-button"
                disabled={date === today}
                onClick={() => setDate(today)}
              >
                Today
              </button>
            </div>

            {page === 'approvals' ? (
              <>
                <div className="search-wrap">
                  <input
                    className="search-input"
                    type="search"
                    placeholder="Search section or teacher..."
                    aria-label="Search section or teacher"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <div className="pills" role="group" aria-label="Grade filter">
                  {[
                    { id: 'ALL', label: 'All' },
                    { id: 'PU1', label: 'PU1' },
                    { id: 'PU2', label: 'PU2' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`pill${grade === item.id ? ' is-active' : ''}`}
                      onClick={() => setGrade(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="content">
        {review ? (
          <SuperAdminReview grade={review.grade} section={review.section} date={reviewDate} />
        ) : page === 'inbox' ? (
          <ChatInbox role="superadmin" date={date} />
        ) : (
          <SuperAdminApprovals date={date} query={query} grade={grade} />
        )}
      </div>
    </Shell>
  )
}
