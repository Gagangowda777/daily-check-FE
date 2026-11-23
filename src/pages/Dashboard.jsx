import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { pageFor, routeHref } from '../lib/router.js'
import Shell from '../components/Shell.jsx'
import StudentSearch from '../components/StudentSearch.jsx'
import AdminModules from './admin/AdminModules.jsx'
import AdminOverview from './admin/AdminOverview.jsx'
import AdminRegister from './admin/AdminRegister.jsx'
import AdminSections from './admin/AdminSections.jsx'
import DataEntry from './admin/DataEntry.jsx'
import ChatInbox from '../components/ChatInbox.jsx'
import InboxHub from '../components/InboxHub.jsx'
import InfoTip from '../components/InfoTip.jsx'
import '../dashboard.css'

const GRADES = [
  { id: 'ALL', label: 'All' },
  { id: 'PU1', label: 'PU1' },
  { id: 'PU2', label: 'PU2' },
]

// Overview, Section progress, Modules and Daily register are kept in the code
// but hidden from the admin portal for now. Add them back to NAV to restore
// them.
const NAV = [
  { id: 'data-entry', label: 'Data entry', href: routeHref('admin/data-entry') },
  { id: 'inbox', label: 'Inbox', href: routeHref('admin/inbox') },
]

const HIDDEN_PAGES = ['overview', 'sections', 'modules', 'register']

// The old tracking, broadcast and announcement links now live inside the
// inbox, so bookmarks open there instead of a blank or retired screen.
const RETIRED_PAGES = { tracking: 'inbox', broadcast: 'inbox', announcement: 'inbox' }

const PAGES = {
  overview: { title: 'School overview', crumb: 'Overview' },
  sections: { title: 'Section progress', crumb: 'Section progress' },
  modules: { title: 'Modules', crumb: 'Modules' },
  register: { title: 'Daily register', crumb: 'Daily register' },
  'data-entry': { title: 'Data Entry', crumb: '' },
  inbox: { title: 'Inbox', crumb: 'Inbox' },
}

const DATA_ENTRY_HELP =
  'Coordinator only. Type the day’s rows exactly as in the workbook. They feed the register, ' +
  'gate and every dashboard. Edits save into that day’s register; deleting a saved row clears it ' +
  'for that date only.'

const todayIso = () => new Date().toLocaleDateString('en-CA')
const prefixFor = (grade) => (grade === 'PU1' ? '11' : '12')

const formatDate = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

export default function Dashboard({ session, route, onSignOut }) {
  const today = todayIso()
  const requested = pageFor(route, 'admin', 'data-entry')
  // Old links to a hidden screen land on Data entry instead of exposing it.
  const page = HIDDEN_PAGES.includes(requested)
    ? 'data-entry'
    : RETIRED_PAGES[requested] || requested
  const meta = PAGES[page] || PAGES['data-entry']

  const [date, setDate] = useState(today)
  const [grade, setGrade] = useState('ALL')
  const [section, setSection] = useState('ALL')
  const [filters, setFilters] = useState({ grades: { PU1: [], PU2: [] }, total: 0 })
  const [reload, setReload] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    api.filters().then(setFilters).catch((err) => setError(err.message))
  }, [])

  const sectionsFor = (gradeId) => filters.grades[gradeId] || []

  const selectGrade = (nextGrade) => {
    setGrade(nextGrade)
    if (nextGrade === 'ALL') {
      // A bare section letter is ambiguous across grades, so a grade must be
      // chosen before a single section can be filtered.
      setSection('ALL')
      return
    }
    const allowed = sectionsFor(nextGrade).map((item) => item.section)
    if (section !== 'ALL' && !allowed.includes(section)) setSection('ALL')
  }

  const selectSection = (value) => {
    if (value === 'ALL') {
      setSection('ALL')
      return
    }
    // Values from the "All" grade view carry their grade ("PU1:A").
    if (value.includes(':')) {
      const [nextGrade, nextSection] = value.split(':')
      setGrade(nextGrade)
      setSection(nextSection)
      return
    }
    setSection(value)
  }

  const gradeGroups = ['PU1', 'PU2'].filter((gradeId) => sectionsFor(gradeId).length > 0)

  const scopeLabel =
    grade === 'ALL'
      ? 'All grades · All sections'
      : `${prefixFor(grade)}${section === 'ALL' ? ' · all sections' : section}`

  const subtitle =
    page === 'inbox' ? (
      'Chats, archived broadcast snapshots and announcements'
    ) : page === 'data-entry' ? (
      <span className="page-meta">
        <span>{filters.total ? `${filters.total.toLocaleString()} on roster` : 'Loading roster…'}</span>
        <InfoTip label="How data entry works">{DATA_ENTRY_HELP}</InfoTip>
      </span>
    ) : (
      `${formatDate(date)} · ${scopeLabel}${filters.total ? ` · ${filters.total} on roster` : ''}`
    )

  return (
    <Shell
      user={{ name: session.label, role: session.email }}
      nav={NAV}
      activeNav={page}
      crumb={meta.crumb}
      title={meta.title}
      subtitle={subtitle}
      onSignOut={onSignOut}
    >
      {page === 'inbox' ? null : (
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

          {page === 'inbox' ? null : (
            <>
          <div className="pills" role="group" aria-label="Grade filter">
                {GRADES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`pill${grade === item.id ? ' is-active' : ''}`}
                    onClick={() => selectGrade(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <select
                className="section-select"
                value={section === 'ALL' || grade === 'ALL' ? 'ALL' : section}
                aria-label="Section filter"
                onChange={(event) => selectSection(event.target.value)}
              >
                <option value="ALL">All sections</option>
                {grade === 'ALL'
                  ? gradeGroups.map((gradeId) => (
                      <optgroup key={gradeId} label={gradeId}>
                        {sectionsFor(gradeId).map((item) => (
                          <option key={`${gradeId}-${item.section}`} value={`${gradeId}:${item.section}`}>
                            {prefixFor(gradeId)}
                            {item.section}
                          </option>
                        ))}
                      </optgroup>
                    ))
                  : sectionsFor(grade).map((item) => (
                      <option key={item.section} value={item.section}>
                        {prefixFor(grade)}
                        {item.section}
                      </option>
                    ))}
              </select>

          <StudentSearch />
            </>
          )}
        </div>
      </section>
      )}

      {error ? <div className="banner">{error}</div> : null}

      {page === 'inbox' ? (
        <InboxHub readTracking canPostAnnouncement>
          <ChatInbox role="admin" />
        </InboxHub>
      ) : page === 'sections' ? (
        <AdminSections date={date} grade={grade} section={section} reload={reload} />
      ) : page === 'modules' ? (
        <AdminModules date={date} onChanged={() => setReload((count) => count + 1)} />
      ) : page === 'register' ? (
        <AdminRegister date={date} grade={grade} section={section} reload={reload} />
      ) : page === 'data-entry' ? (
        <DataEntry date={date} />
      ) : (
        <AdminOverview
          date={date}
          grade={grade}
          section={section}
          reload={reload}
          onChanged={() => setReload((count) => count + 1)}
        />
      )}
    </Shell>
  )
}
