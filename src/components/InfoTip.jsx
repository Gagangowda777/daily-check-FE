import { useState } from 'react'

// Small (i) button that reveals a helper note on hover, focus or click.
export default function InfoTip({ label = 'Show help', children }) {
  const [open, setOpen] = useState(false)
  return (
    <span
      className="info-tip"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="info-tip-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open ? (
        <span className="info-tip-pop" role="tooltip">
          {children}
        </span>
      ) : null}
    </span>
  )
}
