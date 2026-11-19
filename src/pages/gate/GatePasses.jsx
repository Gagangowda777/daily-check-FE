import { useState } from 'react'
import { api } from '../../lib/api.js'
import { ExcelSheet } from '../../components/ExcelSheet.jsx'

export default function GatePasses({ passes = [], onRefresh, onNotice, onError }) {
  const [filter, setFilter] = useState('all') // 'all' | 'pending' | 'exited'
  const [search, setSearch] = useState('')
  const [busyRoll, setBusyRoll] = useState(null)

  const query = search.trim().toLowerCase()

  const filteredPasses = passes.filter((p) => {
    if (filter === 'pending' && p.exited) return false
    if (filter === 'exited' && !p.exited) return false
    if (!query) return true
    return (
      p.rollNo.toLowerCase().includes(query) ||
      p.name.toLowerCase().includes(query) ||
      p.classLabel.toLowerCase().includes(query) ||
      (p.reason && p.reason.toLowerCase().includes(query)) ||
      (p.approvedBy && p.approvedBy.toLowerCase().includes(query))
    )
  })

  const pendingCount = passes.filter((p) => !p.exited).length
  const exitedCount = passes.filter((p) => p.exited).length

  const handleLogExit = async (pass) => {
    setBusyRoll(pass.rollNo)
    try {
      await api.gateLog({
        rollNo: pass.rollNo,
        type: 'exit',
        status: 'authorized',
        passDetails: pass.reason || 'Authorized gate pass',
        remarks: '',
      })
      onNotice(`Campus departure logged for ${pass.name} (${pass.rollNo})`)
      onRefresh()
    } catch (err) {
      onError(err.message)
    } finally {
      setBusyRoll(null)
    }
  }

  const toolbar = (
    <div className="xls-toolbar">
      {[
        { id: 'all', label: `All passes ${passes.length}` },
        { id: 'pending', label: `Pending exit ${pendingCount}` },
        { id: 'exited', label: `Departed ${exitedCount}` },
      ].map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`xls-pill${filter === tab.id ? ' is-active' : ''}`}
          onClick={() => setFilter(tab.id)}
        >
          {tab.label}
        </button>
      ))}
      <input
        type="search"
        className="gate-filter-input"
        placeholder="Filter by roll, name, class, reason..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>
  )

  return (
    <ExcelSheet
      title="Authorized gate passes"
      meta={`${filteredPasses.length} of ${passes.length} passes`}
      note="Students approved for early dismissal, authorized exit or sent home."
      toolbar={toolbar}
      columns={[
        'Sl. no.',
        'Roll no',
        'Student',
        'Class',
        'Approved exit',
        'Approver',
        'Reason / gate pass',
        'Status',
        'Action',
      ]}
    >
      {filteredPasses.length === 0 ? (
        <tr>
          <td className="xls-empty" colSpan={9}>
            No authorized passes matching current filter.
          </td>
        </tr>
      ) : (
        filteredPasses.map((pass, index) => (
          <tr key={pass.id} className="xls-row">
            <td className="xls-no">{index + 1}</td>
            <td className="xls-name">{pass.rollNo}</td>
            <td>{pass.name}</td>
            <td>
              <span className="badge-status is-blue">{pass.classLabel}</span>
            </td>
            <td className="xls-time">{pass.exitTime || 'Today'}</td>
            <td>{pass.approvedBy || 'Teacher'}</td>
            <td>{pass.reason}</td>
            <td>
              {pass.exited ? (
                <span className="badge-status is-green">Departed</span>
              ) : (
                <span className="badge-status is-amber">Pending exit</span>
              )}
            </td>
            <td className="xls-actions">
              {pass.exited ? (
                <span className="xls-count">Logged</span>
              ) : (
                <button
                  type="button"
                  className="btn-mini-log"
                  disabled={busyRoll === pass.rollNo}
                  onClick={() => handleLogExit(pass)}
                >
                  {busyRoll === pass.rollNo ? 'Logging…' : 'Log exit'}
                </button>
              )}
            </td>
          </tr>
        ))
      )}
    </ExcelSheet>
  )
}
