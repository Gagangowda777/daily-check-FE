import { useState } from 'react'
import ArchiveGallery from './ArchiveGallery.jsx'
import AnnouncementBoard from './AnnouncementBoard.jsx'
import './inboxhub.css'

// The inbox holds every school-wide notice: the chats, the broadcast archive
// and the announcement photos. One tab strip replaces the three separate
// screens each dashboard used to carry in its side nav.
const TABS = [
  { id: 'chats', label: 'Chats' },
  { id: 'announcement', label: 'Announcement' },
  { id: 'broadcast', label: 'Broadcast' },
]

export default function InboxHub({ children, canPostAnnouncement = false }) {
  const [tab, setTab] = useState('chats')

  return (
    <div className="ih-wrap">
      <div className="ih-tabs" role="tablist" aria-label="Inbox sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`ih-tab${tab === item.id ? ' is-active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* The chat pane stays mounted so a half-written message survives a look
          at the announcements. */}
      <div className="ih-pane" hidden={tab !== 'chats'}>
        {children}
      </div>
      {tab === 'broadcast' ? <ArchiveGallery /> : null}
      {tab === 'announcement' ? <AnnouncementBoard readOnly={!canPostAnnouncement} /> : null}
    </div>
  )
}
