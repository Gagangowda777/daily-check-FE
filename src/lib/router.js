import { useEffect, useState } from 'react'

// A tiny hash router. Every screen is a real URL (`#/admin/register`), so
// refresh, back/forward and shared links all work without a server rewrite.

const normalize = (hash = '') => hash.replace(/^#\/?/, '').replace(/\/+$/, '')

export const routeHref = (path) => `#/${path}`

export function navigate(path) {
  const next = routeHref(path)
  if (window.location.hash !== next) window.location.hash = next
}

export function useRoute() {
  const [route, setRoute] = useState(() => normalize(window.location.hash))

  useEffect(() => {
    const sync = () => {
      setRoute(normalize(window.location.hash))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  return route
}

// "admin/register" -> "register" when the area matches, else the fallback.
export function pageFor(route, area, fallback) {
  const [prefix, page] = route.split('/')
  return prefix === area && page ? page : fallback
}
