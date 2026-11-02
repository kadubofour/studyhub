const DAY = 86_400_000

/** "just now", "10m ago", "10h ago", "3d ago", "2w ago", then the date */
export function ago(iso: string, now: Date): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const ms = Math.max(0, now.getTime() - t)
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`
  if (ms < DAY) return `${Math.floor(ms / 3_600_000)}h ago`
  if (ms < 14 * DAY) return `${Math.floor(ms / DAY)}d ago`
  if (ms < 60 * DAY) return `${Math.floor(ms / (7 * DAY))}w ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
