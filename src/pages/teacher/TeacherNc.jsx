import { useState } from 'react'
import { api } from '../../lib/api.js'

export default function TeacherNc({ data, grade, section, busy, run }) {
  const [draft, setDraft] = useState(null)
  const [localError, setLocalError] = useState('')
  const ncDone = data.nc.count !== null && data.nc.updatedInNe

  const save = async (updatedInNe) => {
    // Never turn an empty field into a silent 0 — the count has to be entered.
    const raw = draft === null ? data.nc.count : draft
    if (raw === null || raw === undefined || String(raw).trim() === '') {
      setLocalError('Enter today’s NC count before saving.')
      return
    }
    const count = Number(raw)
    if (!Number.isFinite(count) || count < 0 || count > 999) {
      setLocalError('Enter an NC count between 0 and 999.')
      return
    }

    setLocalError('')
    const ok = await run(
      'nc',
      () => api.teacherNc({ grade, section, count: Math.round(count), updatedInNe }),
      updatedInNe ? 'Marked updated in NE.' : 'NC count saved.'
    )
    if (ok) setDraft(null)
  }

  return (
    <section className="t-card">
      <div className="t-card-head">
        <h2>Daily NC tracker</h2>
        <span className={`t-count${ncDone ? ' is-ok' : ' is-alert'}`}>
          {ncDone ? 'NE updated' : 'NE pending'}
        </span>
      </div>
      <div className="t-body">
        {localError ? <div className="banner">{localError}</div> : null}
        <div className="nc-row">
          <input
            className="form-input nc-input"
            type="number"
            min="0"
            max="999"
            step="1"
            aria-label="NC count"
            placeholder="NC count"
            value={draft ?? (data.nc.count ?? '')}
            onChange={(event) => {
              setDraft(event.target.value)
              setLocalError('')
            }}
          />
          <button type="button" className="tap" disabled={busy === 'nc'} onClick={() => save(data.nc.updatedInNe)}>
            Save
          </button>
        </div>

        <div className="t-actions">
          <span className="t-row-sub">Updated in NE?</span>
          {[true, false].map((value) => (
            <button
              key={String(value)}
              type="button"
              className={`tap${data.nc.updatedInNe === value ? '' : ' is-quiet'}`}
              disabled={busy === 'nc'}
              onClick={() => save(value)}
            >
              {value ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
        <p className="t-row-sub">
          The class teacher marks the NC count as updated in NE before closing the daily check.
        </p>
      </div>
    </section>
  )
}
