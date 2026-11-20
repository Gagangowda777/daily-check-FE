import ChatInbox from '../../components/ChatInbox.jsx'

// The class teacher's WhatsApp-style inbox: admin notices, leader notes and
// direct messages land in one conversation list, and replies go out from the
// matching thread.
export default function TeacherInbox({ onSent }) {
  return <ChatInbox role="teacher" onSent={onSent} />
}
