const initialsFor = (name = '') =>
  name
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '—'

export default function Shell({
  user,
  nav = [],
  activeNav,
  crumb,
  title,
  subtitle,
  actions,
  onSignOut,
  children,
}) {
  const initials = initialsFor(user?.name)

  const navLink = (item) => (
    <a
      key={item.id}
      className={`nav-item${activeNav === item.id ? ' is-active' : ''}`}
      href={item.href || `#${item.id}`}
      aria-current={activeNav === item.id ? 'page' : undefined}
    >
      <span>{item.label}</span>
      {item.chip ? <span className="nav-chip">{item.chip}</span> : null}
    </a>
  )

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-mark">Daily Check</div>

        <div className="user">
          <span className="user-avatar">{initials}</span>
          <span className="user-text">
            <span className="user-name">{user?.name}</span>
            <span className="user-role">{user?.role}</span>
          </span>
        </div>

        <nav className="nav" aria-label="Dashboard sections">
          {nav.map(navLink)}
        </nav>

        <button type="button" className="logout" onClick={onSignOut}>
          Log out
        </button>
      </aside>

      <div className="shell-main">
        <div className="shell-top">
          <span className="brand-mark">Daily Check</span>
          <button type="button" className="shell-top-logout" onClick={onSignOut}>
            Log out
          </button>
        </div>

        {nav.length ? (
          <nav className="shell-nav" aria-label="Dashboard sections">
            {nav.map(navLink)}
          </nav>
        ) : null}

        <main className="main">
          <header className="page-head">
            {crumb ? <p className="crumb">{crumb}</p> : null}
            <h1 className="page-title">{title}</h1>
            {subtitle ? <p className="page-sub">{subtitle}</p> : null}
          </header>

          {actions ? <div className="page-actions">{actions}</div> : null}

          {children}
        </main>
      </div>
    </div>
  )
}
