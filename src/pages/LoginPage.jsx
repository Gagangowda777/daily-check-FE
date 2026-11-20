import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

// The Transport In-charge and Gate / Security dashboards are kept in the code
// but hidden from the portal for now; put their entries back here to re-enable
// them.
const LOGIN_TYPES = [
  { id: 'superadmin', label: 'Super Admin', email: 'superadmin@dailycheck.demo' },
  { id: 'admin', label: 'Admin / Coordinator', email: 'admin@dailycheck.demo' },
  { id: 'teacher', label: 'Class Teacher', email: 'teacher@dailycheck.demo' },
  { id: 'leader', label: 'Class Leader', email: 'leader@dailycheck.demo' },
]

const DEFAULT_TYPE = LOGIN_TYPES.find((item) => item.id === 'admin') || LOGIN_TYPES[0]

const DEMO_PASSWORD = 'demo1234'

// These logins are scoped to one section.
const SECTION_ROLES = ['teacher', 'leader']

function EyeIcon({ open }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {open ? (
        <>
          <path
            d="M3 12s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
        </>
      ) : (
        <>
          <path
            d="M3 12s3.4-6 9-6 9 6 9 6-3.4 6-9 6-9-6-9-6Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="m5 19 14-14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

function LockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="4" y="10.5" width="16" height="9.5" rx="2.2" />
      <path d="M8 10.5V7a4 4 0 1 1 8 0v3.5" />
    </svg>
  )
}

export default function LoginPage({ onSignIn }) {
  const [type, setType] = useState(DEFAULT_TYPE)
  const [email, setEmail] = useState(DEFAULT_TYPE.email)
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [showPassword, setShowPassword] = useState(false)
  const [sections, setSections] = useState([])
  const [assigned, setAssigned] = useState('PU1:A')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    api
      .publicSections()
      .then((data) => {
        if (!alive) return
        const list = ['PU1', 'PU2'].flatMap((grade) =>
          (data.grades[grade] || []).map((item) => ({
            grade,
            section: item.section,
            label: `${grade === 'PU1' ? '11' : '12'}${item.section}`,
          }))
        )
        setSections(list)
      })
      .catch(() => {
        if (alive) setSections([])
      })
    return () => {
      alive = false
    }
  }, [])

  const chooseType = (next) => {
    setType(next)
    setEmail(next.email)
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.')
      return
    }

    const bound = sections.find((item) => `${item.grade}:${item.section}` === assigned)

    setBusy(true)
    setError('')
    try {
      const result = await api.login({
        role: type.id,
        email: email.trim(),
        password,
        grade: SECTION_ROLES.includes(type.id) ? bound?.grade || 'PU1' : null,
        section: SECTION_ROLES.includes(type.id) ? bound?.section || 'A' : null,
      })
      onSignIn(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <main className="card">
        <p className="brand-line">Daily Check</p>
        <div className="divider" style={{ margin: '20px 0 0' }} />

        <h1 className="title">Campus Portal</h1>
        <p className="subtitle">Sign in with your institutional account</p>

        <div className="role-block">
          <span className="label">Sign in as</span>
          <div className="role-grid" role="radiogroup" aria-label="Login type">
            {LOGIN_TYPES.map((item) => {
              const active = item.id === type.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`role-button${active ? ' is-active' : ''}`}
                  onClick={() => chooseType(item)}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <form className="form" onSubmit={handleSubmit} noValidate>
          {SECTION_ROLES.includes(type.id) ? (
            <div className="field">
              <label className="label" htmlFor="assigned-section">
                Assigned section
              </label>
              <select
                className="input"
                id="assigned-section"
                value={assigned}
                onChange={(event) => setAssigned(event.target.value)}
              >
                {sections.length === 0 ? <option value="PU1:A">11A</option> : null}
                {sections.map((item) => (
                  <option key={`${item.grade}:${item.section}`} value={`${item.grade}:${item.section}`}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="field">
            <label className="label" htmlFor="identifier">
              Email
            </label>
            <input
              className="input"
              id="identifier"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setError('')
              }}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="password">
              Password
            </label>
            <span className="password-wrap">
              <input
                className="input password-input"
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value)
                  setError('')
                }}
              />
              <button
                type="button"
                className="eye-button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </span>
          </div>

          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </button>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <div className="demo-panel">
          <LockIcon />
          <span>Demo access</span>
          <span className="demo-key">{DEMO_PASSWORD}</span>
        </div>

        <div className="divider" />
        <p className="footer">
          Developed by <strong>Start Smart, SE</strong>
        </p>
      </main>
    </div>
  )
}
