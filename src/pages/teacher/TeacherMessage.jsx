import { useState } from 'react'
import { api } from '../../lib/api.js'

const MESSAGE_OPTIONS = [
  { id: 'update', label: 'Update' },
  { id: 'authorized-exit', label: 'Authorized Exit' },
]

const MESSAGE_TONE = {
  sent: 'none',
  seen: 'late',
  acknowledged: 'present',
  overdue: 'pending',
}

export default function TeacherMessage({ data, grade, section, busy, run }) {
  const [type, setType] = useState('update')

  return (
    <section className="t-card">
      <div className="t-card-head">
        <h2>Class leader message</h2>
        {data.message ? (
          <span className={`badge ${MESSAGE_TONE[data.message.status]}`}>{data.message.status}</span>
        ) : (
          <span className="t-count">none</span>
        )}
      </div>
      <div className="t-body">
        <div className="t-actions">
          {MESSAGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`tap${type === option.id ? '' : ' is-quiet'}`}
              onClick={() => setType(option.id)}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            className="tap is-good"
            disabled={busy === 'message'}
            onClick={() =>
              run(
                'message',
                () => api.teacherMessage({ grade, section, type }),
                'Message sent to the class leader.'
              )
            }
          >
            Send
          </button>
        </div>

        {data.message ? (
          <p className="msg-status">
            <strong>{data.message.title}</strong>
            <span>sent {data.message.sentAt}</span>
            <span>
              {data.message.acknowledgedAt
                ? `acked ${data.message.acknowledgedAt}`
                : data.message.seenAt
                  ? `seen ${data.message.seenAt}`
                  : 'not seen yet'}
            </span>
          </p>
        ) : (
          <p className="muted">No message sent to the class leader today.</p>
        )}
        <p className="t-row-sub">
          The leader acknowledges messages from their inbox. Send a message before closing the check.
        </p>
      </div>
    </section>
  )
}
