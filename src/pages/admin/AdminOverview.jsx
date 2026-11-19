import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import ActionBar from '../../components/ActionBar.jsx'
import KpiCards from '../../components/KpiCards.jsx'
import MessageInbox from '../../components/MessageInbox.jsx'

// Overview keeps only the live counters and the quick actions, so the page
// reads as one screen instead of a scroll through every module.
export default function AdminOverview({ date, grade, section, reload, onChanged }) {
  const [state, setState] = useState({ key: '', kpi: null })
  const [outbox, setOutbox] = useState({ key: '', account: null, total: 0, limited: true, rows: [] })
  const [outboxError, setOutboxError] = useState('')
  const [titleQuery, setTitleQuery] = useState('')
  const [debouncedTitle, setDebouncedTitle] = useState('')
  const [dayFilter, setDayFilter] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')
  const [openDetails, setOpenDetails] = useState(() => new Set())
  const [readFilters, setReadFilters] = useState({})
  const key = `${date}|${grade}|${section}|${reload}`
  const lookingUp = Boolean(debouncedTitle || dayFilter || sortOrder === 'oldest')
  const outboxKey = `${reload}|${debouncedTitle}|${dayFilter}|${sortOrder}`

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedTitle(titleQuery.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [titleQuery])

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

  useEffect(() => {
    let alive = true
    api
      .sentMessages({
        q: debouncedTitle,
        date: dayFilter,
        sort: sortOrder,
      })
      .then((payload) => {
        if (alive) {
          setOutbox({
            key: outboxKey,
            account: payload.account,
            total: payload.total,
            limited: Boolean(payload.limited),
            rows: payload.messages,
          })
          setOutboxError('')
        }
      })
      .catch((err) => {
        if (alive) setOutboxError(err.message)
      })
    return () => {
      alive = false
    }
  }, [outboxKey, debouncedTitle, dayFilter, sortOrder])

  const loading = state.key !== key
  const outboxLoading = outbox.key !== outboxKey
  const hasFilters = Boolean(debouncedTitle || dayFilter)

  const toggleDetails = (id) => {
    setOpenDetails((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearLookup = () => {
    setTitleQuery('')
    setDebouncedTitle('')
    setDayFilter('')
    setSortOrder('newest')
  }

  return (
    <div className="content">
      {state.error ? <div className="banner">{state.error}</div> : null}

      <ActionBar date={date} onCreated={onChanged} />

      <KpiCards kpi={loading ? null : state.kpi} />

      <MessageInbox
        title="Inbox"
        emptyText="No direct messages from teachers, leaders or other desks today."
      />

      <section className="sent-card">
        <div className="sent-head">
          <div>
            <h2>Sent messages</h2>
            <p>
              {lookingUp ? 'Messages from ' : 'Last five from '}
              <strong>{outbox.account || 'this admin account'}</strong>
              {hasFilters ? ', filtered by title or day' : sortOrder === 'oldest' ? ', oldest first' : ''}
            </p>
          </div>
          <span className="sent-count">
            {outboxLoading
              ? 'Loading…'
              : hasFilters
                ? `${outbox.total} match${outbox.total === 1 ? '' : 'es'}`
                : `${outbox.total} sent`}
          </span>
        </div>

        <div className="sent-toolbar">
          <label className="sent-field">
            <span>Search title</span>
            <input
              className="search-input"
              type="search"
              value={titleQuery}
              onChange={(event) => setTitleQuery(event.target.value)}
              placeholder="Find a message by title"
            />
          </label>

          <label className="sent-field">
            <span>Day</span>
            <input
              className="date-input"
              type="date"
              value={dayFilter}
              onChange={(event) => setDayFilter(event.target.value)}
            />
          </label>

          <label className="sent-field">
            <span>Sort by date</span>
            <select
              className="section-select"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>

          {hasFilters || sortOrder !== 'newest' || titleQuery ? (
            <button type="button" className="ghost-button sent-clear" onClick={clearLookup}>
              Show last five
            </button>
          ) : null}
        </div>

        {outboxError ? <div className="banner">{outboxError}</div> : null}

        {outboxLoading ? (
          <p className="sent-empty">Loading sent messages…</p>
        ) : outbox.rows.length === 0 ? (
          <p className="sent-empty">
            {hasFilters
              ? 'No messages match that title or day.'
              : 'No messages sent from this account yet. Use “Send message” above.'}
          </p>
        ) : (
          <ul className="sent-list">
            {outbox.rows.map((message) => {
              const open = openDetails.has(message.id)
              const recipients = message.recipients || []
              const readFilter = readFilters[message.id] || 'all'
              const readCount = recipients.filter((row) => row.readAt).length
              const visibleRecipients = recipients.filter((row) =>
                readFilter === 'read' ? Boolean(row.readAt) : readFilter === 'unread' ? !row.readAt : true
              )
              return (
                <li key={message.id} className="sent-item">
                  <div className="sent-item-top">
                    <strong>{message.title}</strong>
                    <span className="sent-type">{message.typeLabel}</span>
                    <span className="sent-when">
                      {message.date} · {message.sentAtIst || message.sentAt} IST
                    </span>
                  </div>

                  {message.body ? <p className="sent-body">{message.body}</p> : null}

                  <div className="sent-meta">
                    <button
                      type="button"
                      className={`sent-target${open ? ' is-open' : ''}`}
                      onClick={() => toggleDetails(message.id)}
                      aria-expanded={open}
                    >
                      <span>{message.target}</span>
                      <span className="sent-target-count">
                        {recipients.length} section{recipients.length === 1 ? '' : 's'}
                      </span>
                      <span className="sent-caret" aria-hidden="true">
                        ▾
                      </span>
                    </button>
                  </div>

                  {open ? (
                    <div className="sent-detail">
                      <div className="sent-filter" role="group" aria-label="Filter recipients by read status">
                        {[
                          { id: 'all', label: 'All', count: recipients.length },
                          { id: 'read', label: 'Read', count: readCount },
                          { id: 'unread', label: 'Unread', count: recipients.length - readCount },
                        ].map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={`sent-filter-btn${readFilter === option.id ? ' is-active' : ''}`}
                            onClick={() =>
                              setReadFilters((prev) => ({ ...prev, [message.id]: option.id }))
                            }
                          >
                            {option.label}
                            <span className="sent-filter-count">{option.count}</span>
                          </button>
                        ))}
                      </div>

                      <p className="sent-detail-summary">
                        <span>
                          <strong>{recipients.filter((row) => row.readAt).length}</strong> of{' '}
                          {recipients.length} class leaders read
                        </span>
                        {message.teacherTotal > 0 ? (
                          <span>
                            <strong>{message.teacherRead}</strong> of {message.teacherTotal} class
                            teachers read
                          </span>
                        ) : null}
                      </p>
                      <div className="sent-detail-scroll">
                        <table className="sent-detail-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Section</th>
                              <th>Class leader</th>
                              <th>Class teacher</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleRecipients.map((row, index) => (
                              <tr key={`${row.grade}-${row.section}`}>
                                <td className="sent-index">{index + 1}</td>
                                <td className="sent-section">{row.label}</td>
                                <td>
                                  {row.readAt ? (
                                    <span className="sent-ok">
                                      {row.readBy || 'Class leader'} · {row.readAt} IST
                                    </span>
                                  ) : (
                                    <span className="sent-pending">Not read yet</span>
                                  )}
                                </td>
                                <td>
                                  {row.teacherReadAt ? (
                                    <span className="sent-ok">
                                      {row.teacherReadBy || 'Class teacher'} ·{' '}
                                      {row.teacherReadAt} IST
                                    </span>
                                  ) : (
                                    <span className="sent-pending">Unread</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            {visibleRecipients.length === 0 ? (
                              <tr>
                                <td className="sent-pending" colSpan={4}>
                                  No sections in this filter.
                                </td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}

        {!outboxLoading && outbox.limited && outbox.total > outbox.rows.length ? (
          <p className="sent-more">
            Showing the last {outbox.rows.length} of {outbox.total}. Search by title or pick a
            day to find an older message.
          </p>
        ) : null}
      </section>
    </div>
  )
}
