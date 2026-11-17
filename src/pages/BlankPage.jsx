export default function BlankPage({ onSignOut }) {
  return (
    <div className="blank-page">
      <button type="button" className="blank-page-signout" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  )
}
