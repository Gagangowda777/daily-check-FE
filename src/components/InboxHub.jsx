import { useState } from 'react'
import ArchiveGallery from './ArchiveGallery.jsx'
import AnnouncementBoard from './AnnouncementBoard.jsx'
import AdminTracking from '../pages/admin/AdminTracking.jsx'
import './inboxhub.css'

// The inbox holds every school-wide notice: the chats, the broadcast archive
// and the announcement photos. One tab strip replaces the three separate
// screens each dashboard used to carry in its side nav.
const TABS = [
  { id: 'chats', label: 'Chats' },
  { id: 'announcement', label: 'Announcement' },
  { id: 'broadcast', label: 'Broadcast' },
]

export default function InboxHub({
  children,
  canPostAnnouncement = false,
  readTracking = false,
  showBroadcast = true,
  showAnnouncement = true,
  announcementUploader = null,
  archiveUploader = null,
}) {
  const [tab, setTab] = useState('chats')
  const tabs = TABS.filter(
    (item) =>
      (showBroadcast || item.id !== 'broadcast') &&
      (showAnnouncement || item.id !== 'announcement')
  )

  return (
    <div className="ih-wrap">
      <div className="ih-tabs" role="tablist" aria-label="Inbox sections">
        {tabs.map((item) => (
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
      {tab === 'broadcast' ? (
        <ArchiveGallery uploader={archiveUploader} />
      ) : readTracking && showAnnouncement && tab === 'announcement' ? (
        <AdminTracking
          fixedKind="announcement"
          showTypeTabs={false}
          announcementUploader={announcementUploader}
          canPostAnnouncement={canPostAnnouncement}
        />
      ) : tab === 'announcement' ? (
        <AnnouncementBoard readOnly={!canPostAnnouncement} />
      ) : null}
    </div>
  )
}
