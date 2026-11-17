import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import ActionBar from '../../components/ActionBar.jsx'
import KpiCards from '../../components/KpiCards.jsx'

// Overview keeps only the live counters and the quick actions, so the page
// reads as one screen instead of a scroll through every module.
export default function AdminOverview({ date, grade, section, reload, onChanged }) {
  const [state, setState] = useState({ key: '', kpi: null })
  const [outbox, setOutbox] = useState({ key: '', account: null, total: 0, rows: [] })
  const [outboxError, setOutboxError] = useState('')
  const key = `${date}|${grade}|${section}|${reload}`
  const outboxKey = String(reload)

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
      .sentMessages()
      .then((payload) => {
        if (alive) {
          setOutbox({ key: outboxKey, account: payload.account, total: payload.total, rows: payload.messages })
          setOutboxError('')
        }
      })
      .catch((err) => {
        if (alive) setOutboxError(err.message)
      })
    return () => {
      alive = false
    }
  }, [outboxKey])

  const loading = state.key !== key
  const outboxLoading = outbox.key !== outboxKey

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
              Broadcasts sent from{' '}
              <strong>{outbox.account || 'this admin account'}</strong>
            </p>
          </div>
          <span className="sent-count">
            {outboxLoading ? 'Loading…' : `${outbox.total} sent`}
          </span>
        </div>

        {outboxError ? <div className="banner">{outboxError}</div> : null}

        {outboxLoading ? (
          <p className="sent-empty">Loading sent messages…</p>
        ) : outbox.rows.length === 0 ? (
          <p className="sent-empty">
            No messages sent from this account yet. Use “Send message” above.
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

        {!outboxLoading && outbox.total > outbox.rows.length ? (
          <p className="sent-more">
            Showing the latest {outbox.rows.length} of {outbox.total}. Older messages are
            available in the audit log.
          </p>
        ) : null}
      </section>
    </div>
  )
}
