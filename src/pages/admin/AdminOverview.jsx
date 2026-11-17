import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import ActionBar from '../../components/ActionBar.jsx'
import KpiCards from '../../components/KpiCards.jsx'

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
            {outbox.rows.map((message) => (
              <li key={message.id} className="sent-item">
                <div className="sent-item-top">
                  <strong>{message.title}</strong>
                  <span className="sent-type">{message.typeLabel}</span>
                  <span className="sent-when">
                    {message.date} · {message.sentAt}
                  </span>
                </div>

                {message.body ? <p className="sent-body">{message.body}</p> : null}

                <div className="sent-meta">
                  <span className="sent-target">{message.target}</span>
                  <span>
                    {message.sectionCount} section{message.sectionCount === 1 ? '' : 's'}
                    {message.sectionsLabel ? `: ${message.sectionsLabel}` : ''}
                  </span>
                  <span>
                    {message.acknowledged}/{message.sectionCount} leader ack
                  </span>
                  {message.teacherTotal > 0 ? (
                    <span>
                      {message.teacherRead}/{message.teacherTotal} teacher read
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
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
