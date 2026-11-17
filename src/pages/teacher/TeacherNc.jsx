import { useState } from 'react'
import { api } from '../../lib/api.js'

export default function TeacherNc({ data, grade, section, busy, run }) {
  const [draft, setDraft] = useState(null)
  const ncDone = data.nc.count !== null && data.nc.updatedInNe

  const save = (updatedInNe) =>
    run(
      'nc',
      async () => {
        await api.teacherNc({
          grade,
          section,
          count: Number(draft ?? data.nc.count ?? 0),
          updatedInNe,
        })
        setDraft(null)
      },
      updatedInNe ? 'Marked updated in NE.' : 'NC count saved.'
    )

  return (
    <section className="t-card">
      <div className="t-card-head">
        <h2>Daily NC tracker</h2>
        <span className={`t-count${ncDone ? ' is-ok' : ' is-alert'}`}>
          {ncDone ? 'NE updated' : 'NE pending'}
        </span>
      </div>
      <div className="t-body">
        <div className="nc-row">
          <input
            className="form-input nc-input"
            type="number"
            min="0"
            max="999"
            aria-label="NC count"
            placeholder="NC count"
            value={draft ?? (data.nc.count ?? '')}
            onChange={(event) => setDraft(event.target.value)}
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
