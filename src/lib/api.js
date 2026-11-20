// Locally the Vite proxy forwards /api to the API. On Vercel set VITE_API_URL
// to the deployed API host, e.g. https://daily-check-be.onrender.com; the
// /api suffix is added here so a bare host still works.
const configuredBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const BASE = configuredBase
  ? configuredBase.endsWith('/api')
    ? configuredBase
    : `${configuredBase}/api`
  : '/api'
const TOKEN_KEY = 'dailycheck.token'

const hasStorage = () => typeof window !== 'undefined' && window.sessionStorage

// Rehydrate the session token on a page refresh.
let token = hasStorage() ? window.sessionStorage.getItem(TOKEN_KEY) || '' : ''

export function setToken(next) {
  token = next || ''
  if (!hasStorage()) return
  if (token) window.sessionStorage.setItem(TOKEN_KEY, token)
  else window.sessionStorage.removeItem(TOKEN_KEY)
}

export const getToken = () => token

const authHeaders = () => (token ? { Authorization: `Bearer ${token}` } : {})

function query(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== 'ALL') search.set(key, value)
  }
  return search.toString()
}

async function read(response) {
  const body = await response.json().catch(() => ({}))

  if (response.status === 401 && token) {
    // The session expired or was revoked; drop it and let the app sign out.
    setToken('')
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('dailycheck:unauthorized'))
    }
  }

  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`)
  }
  return body
}

const get = (path) =>
  fetch(`${BASE}${path}`, { headers: authHeaders() }).then(read)

const send = (path, method, payload) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  }).then(read)

const post = (path, payload) => send(path, 'POST', payload)

export const api = {
  setToken,
  getToken,

  // Public: no token yet.
  login: (payload) =>
    fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(read),
  publicSections: () => fetch(`${BASE}/auth/sections`).then(read),

  filters: () => get('/filters'),
  kpi: (params) => get(`/kpi?${query(params)}`),
  records: (params) => get(`/records?${query(params)}`),
  sections: (params) => get(`/sections?${query(params)}`),
  search: (text) => get(`/students/search?q=${encodeURIComponent(text)}`),
  student: (rollNo) => get(`/students/${encodeURIComponent(rollNo)}`),
  addStudent: (payload) => post('/students', payload),
  updateStudent: (rollNo, payload) =>
    send(`/students/${encodeURIComponent(rollNo)}`, 'PUT', payload),
  bulkStudents: (payload) => post('/students/bulk', payload),

  addExitRestriction: (payload) => post('/restrictions/exit', payload),
  bulkExitRestrictions: (payload) => post('/restrictions/exit/bulk', payload),
  addEntryRestriction: (payload) => post('/restrictions/entry', payload),
  bulkEntryRestrictions: (payload) => post('/restrictions/entry/bulk', payload),
  sendMessage: (payload) => post('/messages', payload),
  sentMessages: (params = {}) => get(`/messages/sent?${query(params)}`),
  inboxMessages: (params = {}) => get(`/messages/inbox?${query(params)}`),
  archives: () => get('/archives'),
  announcements: () => get('/announcements'),
  postAnnouncement: (payload) => post('/announcements', payload),
  viewAnnouncement: (id) => post(`/announcements/${encodeURIComponent(id)}/view`, {}),
  sendInboxMessage: (payload) => post('/messages/inbox', payload),

  handovers: (params) => get(`/handovers?${query(params)}`),
  handoverOutcome: (rollNo, payload) =>
    post(`/handovers/${encodeURIComponent(rollNo)}/outcome`, payload),

  exitRestrictions: (params) => get(`/restrictions/exit?${query(params)}`),
  resolveExit: (rollNo, payload) =>
    post(`/restrictions/exit/${encodeURIComponent(rollNo)}/resolve`, payload),
  excuseExit: (rollNo, payload) =>
    post(`/restrictions/exit/${encodeURIComponent(rollNo)}/excuse`, payload),

  buses: (params) => get(`/buses?${query(params)}`),
  convertBus: (route, payload) => post(`/buses/${encodeURIComponent(route)}/convert`, payload),

  teacherToday: (params) => get(`/teacher/today?${query(params)}`),
  teacherNotes: (params) => get(`/teacher/notes?${query(params)}`),
  teacherNoteRead: (id, payload) =>
    post(`/teacher/notes/${encodeURIComponent(id)}/read`, payload),
  teacherNotices: (params) => get(`/teacher/notices?${query(params)}`),
  teacherNoticeRead: (id, payload) =>
    post(`/teacher/notices/${encodeURIComponent(id)}/read`, payload),
  teacherExit: (rollNo, action, payload) =>
    post(`/teacher/exit/${encodeURIComponent(rollNo)}/${action}`, payload),
  teacherEntry: (rollNo, action, payload) =>
    post(`/teacher/entry/${encodeURIComponent(rollNo)}/${action}`, payload),
  teacherNc: (payload) => post('/teacher/nc', payload),
  teacherAttendance: (rollNo, payload) =>
    post(`/teacher/attendance/${encodeURIComponent(rollNo)}`, payload),
  teacherAnnounceAdmin: (payload) => post('/teacher/admin-data/announce', payload),
  teacherAckAdmin: (payload) => post('/teacher/admin-data/acknowledge', payload),
  teacherAckRowAdmin: (payload) => post('/teacher/admin-data/row/acknowledge', payload),
  teacherClose: (payload) => post('/teacher/check/close', payload),
  teacherMessage: (payload) => post('/teacher/message', payload),

  transportToday: (params) => get(`/transport/today?${query(params)}`),
  transportArrive: (route, payload) =>
    post(`/transport/routes/${encodeURIComponent(route)}/arrive`, payload),
  transportTime: (route, payload) =>
    post(`/transport/routes/${encodeURIComponent(route)}/time`, payload),
  transportOverride: (route, payload) =>
    post(`/transport/routes/${encodeURIComponent(route)}/override`, payload),
  transportRider: (route, rollNo, payload) =>
    post(`/transport/routes/${encodeURIComponent(route)}/students/${encodeURIComponent(rollNo)}`, payload),

  inbox: (params) => get(`/inbox?${query(params)}`),
  markInboxRead: (id, payload) =>
    post(`/messages/inbox/${encodeURIComponent(id)}/read`, payload),

  leaderToday: (params) => get(`/leader/today?${query(params)}`),
  leaderRegister: (params) => get(`/leader/register?${query(params)}`),
  leaderAttendance: (rollNo, payload) =>
    post(`/leader/attendance/${encodeURIComponent(rollNo)}`, payload),
  leaderTrend: (params) => get(`/leader/trend?${query(params)}`),
  leaderNotes: (params) => get(`/leader/notes?${query(params)}`),
  leaderNoteSend: (payload) => post('/leader/notes', payload),

  gateToday: (params = {}) => get(`/gate/today?${query(params)}`),
  gateCheck: (rollNo, params = {}) =>
    get(`/gate/check/${encodeURIComponent(rollNo)}?${query(params)}`),
  gateLog: (payload) => post('/gate/log', payload),
  gateLogs: (params = {}) => get(`/gate/logs?${query(params)}`),

  superAdminToday: (params) => get(`/superadmin/today?${query(params)}`),
  superAdminApprove: (payload) => post('/superadmin/approve', payload),

  dataEntry: (date) => get(`/datasheet/${encodeURIComponent(date)}`),
  saveDataEntry: (payload) => post('/datasheet/entry', payload),
  saveNcSheet: (payload) => post('/datasheet/nc', payload),

  settings: () => get('/settings'),
  saveSettings: (payload) => send('/settings', 'PUT', payload),
  audit: (limit = 40) => get(`/audit?limit=${limit}`),
}
