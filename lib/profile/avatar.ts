// Eight colours for the avatar; white initials read well on each (checked in tests)
export const AVATAR_COLORS = ['#3B5BDB', '#6741D9', '#0B7A5E', '#C2410C', '#BE185D', '#A15C07', '#0E7490', '#475569'] as const
export const DEFAULT_AVATAR = AVATAR_COLORS[0]

export const isAvatarColor = (v: unknown): v is (typeof AVATAR_COLORS)[number] =>
  typeof v === 'string' && AVATAR_COLORS.some(c => c.toLowerCase() === v.toLowerCase())

const first = (s: string) => Array.from(s)[0] ?? ''

// The first letter of the first and last name (one letter for a single name); the email's first letter when there is no name
export function initials(name: string | null, email: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (first(words[0]) + first(words[words.length - 1])).toUpperCase()
  if (words.length === 1) return first(words[0]).toUpperCase()
  const e = first((email ?? '').trim())
  return e ? e.toUpperCase() : '?'
}
