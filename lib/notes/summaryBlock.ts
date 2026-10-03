// A note's AI summary is a quote block at the very top whose first line is **Summary**.
// It is ordinary note Markdown, so search, export and printing include it with no special cases.

// The whole block: the header line, then every following line that starts with ">"
const BLOCK = /^>[ \t]*\*\*Summary\*\*[ \t]*(?:\n>[^\n]*)*(?:\n|$)/

export function getSummary(md: string): string | null {
  const m = md.match(BLOCK)
  if (!m) return null
  const body = m[0].split('\n').slice(1).map(l => l.replace(/^>[ \t]?/, '')).join('\n').trim()
  return body || null
}

export function removeSummary(md: string): string {
  return md.match(BLOCK) ? md.replace(BLOCK, '').replace(/^\n+/, '') : md
}

export function setSummary(md: string, summary: string): string {
  const quoted = summary.trim().split('\n').map(l => (l.trim() ? `> ${l}` : '>')).join('\n')
  const rest = removeSummary(md)
  return `> **Summary**\n>\n${quoted}\n${rest ? `\n${rest}` : ''}`
}
