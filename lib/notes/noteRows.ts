// The notes list on a phone, as notes apps show it: notes grouped by when they were last edited, each with its date and the
// first line of its text under the title.

/** The first line of a note's text, as plain words: no Markdown marks, pictures, links' addresses or maths delimiters */
export function previewLine(md: string | null | undefined): string {
  if (!md) return ''
  for (const raw of md.split('\n')) {
    const line = raw
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')            // pictures
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')           // links keep their words
      .replace(/<[^>]+>/g, ' ')                          // html
      .replace(/^\s{0,3}(#{1,6}\s+|>\s*|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)/, '') // headings, quotes, lists, checklists
      .replace(/\$\$?([^$]*)\$\$?/g, '$1')               // maths keeps its text
      .replace(/(\*\*|__|~~|==|`)/g, '')                 // bold, strikethrough, highlight, code
      .replace(/(^|\s)[*_](\S)/g, '$1$2').replace(/(\S)[*_](\s|$)/g, '$1$2') // italics
      .replace(/^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*$/, '')    // a table's rule
      .replace(/\|/g, ' ')
      .replace(/^[-*_]{3,}$/, '')                        // a horizontal rule
      .replace(/\s+/g, ' ').trim()
    if (line) return line
  }
  return ''
}

const DAY = 86_400_000
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** Today, Yesterday, Previous 7 days, Previous 30 days, then each month ("October"; "October 2025" in another year) */
export function groupLabel(iso: string, now: Date): string {
  const d = new Date(iso)
  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'Previous 7 days'
  if (days < 30) return 'Previous 30 days'
  return d.toLocaleDateString('en-GB', d.getFullYear() === now.getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' })
}

/** Notes in the order given, split into date groups (in the order they first appear) */
export function groupByDate<T extends { updated_at: string }>(notes: T[], now: Date): { label: string; notes: T[] }[] {
  const out: { label: string; notes: T[] }[] = []
  for (const n of notes) {
    const label = groupLabel(n.updated_at, now)
    const last = out[out.length - 1]
    if (last?.label === label) last.notes.push(n)
    else out.push({ label, notes: [n] })
  }
  return out
}

/** The date in a row: the time today, the weekday this week, otherwise the date */
export function rowDate(iso: string, now: Date): string {
  const d = new Date(iso)
  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY)
  if (days <= 0) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'long' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: '2-digit' })
}

/** "30 October 2026 at 16:12", above an open note's title */
export function editedLine(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} at ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
}
