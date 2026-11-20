import { useEffect, useState } from 'react'
import LoginPage from './pages/LoginPage.jsx'
import Dashboard from './pages/Dashboard.jsx'
import TeacherDashboard from './pages/TeacherDashboard.jsx'
import GateDashboard from './pages/GateDashboard.jsx'
import LeaderDashboard from './pages/LeaderDashboard.jsx'
import TransportDashboard from './pages/TransportDashboard.jsx'
import SuperAdminDashboard from './pages/SuperAdminDashboard.jsx'
import { api } from './lib/api.js'
import { navigate, useRoute } from './lib/router.js'
import './App.css'
import './shell.css'

const SESSION_KEY = 'dailycheck.session'

// These dashboards still exist, but their sign-in options are hidden for now,
// so an old saved session must not reopen them.
const HIDDEN_ROLES = ['transport', 'gate']

// Where each role lands when the URL does not name one of its screens.
const HOME = {
  superadmin: 'superadmin/approvals',
  admin: 'admin/data-entry',
  teacher: 'teacher/overview',
  leader: 'leader/overview',
  transport: 'transport/routes',
  gate: 'gate/check',
}

const readSession = () => {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(SESSION_KEY)) || null
    return saved && !HIDDEN_ROLES.includes(saved.role) ? saved : null
  } catch {
    return null
  }
}

// Keep the browser tab in step with the screen the user is on.
const TITLES = {
  superadmin: 'Daily Check · Super Admin',
  admin: 'Daily Check · Admin',
  teacher: 'Daily Check · Class Teacher',
  transport: 'Daily Check · Transport',
  leader: 'Daily Check · Class Leader',
  gate: 'Daily Check · Gate & Security',
}

export default function App() {
  const [session, setSession] = useState(readSession)
  const route = useRoute()

  const signOut = () => {
    api.setToken('')
    window.sessionStorage.clear()
    navigate('')
    setSession(null)
  }

  useEffect(() => {
    // Any 401 from the API (expired/revoked token) drops the session.
    const onUnauthorized = () => {
      window.sessionStorage.clear()
      setSession(null)
    }
    window.addEventListener('dailycheck:unauthorized', onUnauthorized)
    return () => window.removeEventListener('dailycheck:unauthorized', onUnauthorized)
  }, [])

  useEffect(() => {
    document.title = session ? TITLES[session.role] || 'Daily Check' : 'Daily Check · Sign In'
  }, [session])

  // Keep each role inside its own area of the app.
  useEffect(() => {
    if (!session) return
    const area = route.split('/')[0]
    if (area !== session.role) navigate(HOME[session.role] || '')
  }, [route, session])

  const signIn = ({ token, user }) => {
    api.setToken(token)
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
    navigate(HOME[user.role] || '')
    setSession(user)
  }

  if (!session) {
    return <LoginPage onSignIn={signIn} />
  }

  if (session.role === 'superadmin') {
    return <SuperAdminDashboard session={session} route={route} onSignOut={signOut} />
  }

  if (session.role === 'teacher') {
    return <TeacherDashboard session={session} route={route} onSignOut={signOut} />
  }

  if (session.role === 'transport') {
    return <TransportDashboard session={session} route={route} onSignOut={signOut} />
  }

  if (session.role === 'leader') {
    return <LeaderDashboard session={session} route={route} onSignOut={signOut} />
  }

  if (session.role === 'gate') {
    return <GateDashboard session={session} route={route} onSignOut={signOut} />
  }

  return <Dashboard session={session} route={route} onSignOut={signOut} />
}
