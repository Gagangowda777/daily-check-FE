// Inbox messages can carry bold/italic/underline. Everything is rebuilt from an
// allowlist so a message from another user can never inject markup or scripts.
const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR'])

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const walk = (node) => {
  if (node.nodeType === 3) return escapeHtml(node.nodeValue || '')
  if (node.nodeType !== 1) return ''
  const inner = [...node.childNodes].map(walk).join('')
  const tag = node.tagName
  if (ALLOWED.has(tag)) return `<${tag.toLowerCase()}>${inner}</${tag.toLowerCase()}>`
  return inner
}

export function sanitizeRich(input) {
  if (!input) return ''
  const doc = new DOMParser().parseFromString(String(input), 'text/html')
  return [...doc.body.childNodes].map(walk).join('')
}

export function richTextToPlain(input) {
  if (!input) return ''
  const doc = new DOMParser().parseFromString(String(input), 'text/html')
  return (doc.body.textContent || '').replace(/\u00a0/g, ' ')
}
