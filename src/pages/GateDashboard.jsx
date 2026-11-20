import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { pageFor, routeHref, navigate } from '../lib/router.js'
import Shell from '../components/Shell.jsx'
import GateCheck from './gate/GateCheck.jsx'
import GatePasses from './gate/GatePasses.jsx'
import GateWatchlist from './gate/GateWatchlist.jsx'
import GateLogs from './gate/GateLogs.jsx'
import GateBuses from './gate/GateBuses.jsx'
import GateInbox from './gate/GateInbox.jsx'
import '../gate.css'

const GATE_NAV = [
  { id: 'check', label: 'Clearance & scanner', href: routeHref('gate/check') },
  { id: 'passes', label: 'Authorized passes', href: routeHref('gate/passes') },
  { id: 'watchlist', label: 'Blocked watchlist', href: routeHref('gate/watchlist') },
  { id: 'logs', label: 'Movement log', href: routeHref('gate/logs') },
  { id: 'buses', label: 'Bus arrivals', href: routeHref('gate/buses') },
  { id: 'inbox', label: 'Inbox', href: routeHref('gate/inbox') },
]

const PAGE_META = {
  check: {
    title: 'Gate clearance & scanner',
    subtitle: 'Verify student roll number, check clearance status, and log campus departures',
  },
  passes: {
    title: 'Authorized gate passes',
    subtitle: 'Students approved for early dismissal, authorized exit, or sent home',
  },
  watchlist: {
    title: 'Exit restriction watchlist',
    subtitle: 'Students prohibited from leaving campus during school hours',
  },
  logs: {
    title: 'Gate movement log',
    subtitle: 'Chronological record of campus entries, exits, and blocked attempts today',
  },
  buses: {
    title: 'Bus arrival monitor',
    subtitle: 'Status of morning bus arrivals entering campus through the main gate',
  },
  inbox: {
    title: 'Inbox',
    subtitle: 'Messages from the admin and the rest of the school',
  },
}

export default function GateDashboard({ session, route, onSignOut }) {
  const page = pageFor(route, 'gate', 'check')
  const meta = PAGE_META[page] || PAGE_META.check

  const [version, setVersion] = useState(0)
  const [state, setState] = useState({ key: '', data: null })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const key = `gate:${version}`
  const data = state.data

  useEffect(() => {
    let alive = true
    api
      .gateToday({})
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
  }, [key])

  const refresh = (msg) => {
    if (msg) setNotice(msg)
    setVersion((v) => v + 1)
  }

  const handleInspect = (rollNo) => {
    navigate('gate/check')
    // Give router time to mount check view if needed
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('gate:inspect', { detail: rollNo }))
    }, 100)
  }

  const nav = GATE_NAV.map((item) => {
    if (item.id === 'passes' && data?.summary?.authorizedPasses) {
      return { ...item, chip: String(data.summary.authorizedPasses) }
    }
    if (item.id === 'watchlist' && data?.summary?.activeRestrictions) {
      return { ...item, chip: String(data.summary.activeRestrictions) }
    }
    return item
  })

  const user = {
    name: session.name || 'Gate & Security',
    role: 'Gate Security Desk',
  }

  return (
    <Shell
      user={user}
      nav={nav}
      activeNav={page}
      crumb="Gate / Security"
      title={meta.title}
      subtitle={
        data
          ? `${data.date} · ${meta.subtitle}`
          : 'Loading gate records…'
      }
      onSignOut={onSignOut}
    >
      <div className="gate-body">
        {/* KPI Summary Cards */}
        {data && (
          <div className="gate-summary">
            <div className="gate-stat is-blocked">
              <span className="gate-stat-label">Active Exit Blocks</span>
              <strong>{data.summary.activeRestrictions}</strong>
              <span className="gate-stat-sub">Prohibited from leaving</span>
            </div>

            <div className="gate-stat is-authorized">
              <span className="gate-stat-label">Authorized Passes</span>
              <strong>{data.summary.authorizedPasses}</strong>
              <span className="gate-stat-sub">Approved exit passes</span>
            </div>

            <div className="gate-stat is-exited">
              <span className="gate-stat-label">Exited Today</span>
              <strong>{data.summary.exitedCount}</strong>
              <span className="gate-stat-sub">Departures verified</span>
            </div>

            <div className="gate-stat is-neutral">
              <span className="gate-stat-label">Movement Events</span>
              <strong>{data.summary.totalLogs}</strong>
              <span className="gate-stat-sub">
                {data.summary.blockedAttempts} blocked attempt(s)
              </span>
            </div>
          </div>
        )}

        {/* Notices & Errors */}
        {notice && (
          <div className="notice-banner" role="status">
            {notice}
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        {/* Sub-views */}
        {page === 'check' && (
          <GateCheck
            data={data}
            onRefresh={refresh}
            onNotice={(msg) => {
              setNotice(msg)
              setError('')
            }}
            onError={(err) => {
              setError(err)
              setNotice('')
            }}
          />
        )}

        {page === 'passes' && (
          <GatePasses
            passes={data?.passes || []}
            onRefresh={refresh}
            onNotice={(msg) => {
              setNotice(msg)
              setError('')
            }}
            onError={(err) => {
              setError(err)
              setNotice('')
            }}
          />
        )}

        {page === 'watchlist' && (
          <GateWatchlist
            restrictions={data?.restrictions || []}
            onInspect={handleInspect}
          />
        )}

        {page === 'logs' && <GateLogs logs={data?.logs || []} />}

        {page === 'buses' && <GateBuses buses={data?.buses || []} />}

        {page === 'inbox' && <GateInbox />}
      </div>
    </Shell>
  )
}
