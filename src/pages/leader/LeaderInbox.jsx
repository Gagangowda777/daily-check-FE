import ChatInbox from '../../components/ChatInbox.jsx'

// The class leader's chat inbox: admin broadcasts and teacher updates in the
// conversation list, with replies to the teacher or admin.
export default function LeaderInbox({ onChanged }) {
  return <ChatInbox role="leader" onSent={onChanged} />
}
