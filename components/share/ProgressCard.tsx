import { initials } from '@/lib/profile/avatar'
import type { SharedProgress } from '@/components/share/SharedView'

const focusTime = (m: number) => (m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`)
const dayCount = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
const short = (s: string, n: number) => (Array.from(s).length > n ? `${Array.from(s).slice(0, n - 1).join('')}…` : s)

// The look's tokens: on the page they follow the student's look and accent; cardPng writes them in for the picture
const C = { bg: 'var(--raised)', fg: 'var(--fg)', muted: 'var(--muted)', line: 'var(--line)', accent: 'var(--accent-solid)' }
const TITLE = 'var(--display-font), var(--app-font), ui-sans-serif, system-ui, sans-serif'
const L = 96
const R = 1080 - 96

/**
 * A student's progress as a 1080×1350 card (a portrait post): the level large in their accent, who they are, and this
 * week's numbers, set in the look's colours and fonts. Plain type and hairlines, no effects, so it draws the same as a PNG.
 */
export function ProgressCard({ snapshot: p, className, ref }: { snapshot: SharedProgress; className?: string; ref?: React.Ref<SVGSVGElement> }) {
  const name = p.display_name || 'Student'
  const focus = focusTime(p.week_focus_minutes)
  const rows: [string, string][] = [['Streak', dayCount(p.streak)], ['This week', `${p.week_xp} XP`], ['Focus this week', focus]]
  const label = `${name}'s progress on Studyhub: level ${p.level}, a ${p.streak}-day streak, ${p.week_xp} XP this week and ${focus} of focus this week`
  return (
    <svg ref={ref} viewBox="0 0 1080 1350" role="img" aria-label={label} className={className} fontFamily={TITLE}>
      <rect width="1080" height="1350" fill={C.bg} />

      <rect x={L} y="84" width="56" height="56" rx="14" fill={C.accent} />
      <text x={L + 28} y="125" textAnchor="middle" fontSize="32" fontWeight="700" fill="#FFFFFF">S</text>
      <text x={L + 80} y="125" fontSize="40" fontWeight="600" fill={C.fg} letterSpacing="-0.5">Studyhub</text>
      <text x={R} y="125" textAnchor="end" fontSize="32" fill={C.muted}>My progress</text>
      <line x1={L} x2={R} y1="200" y2="200" stroke={C.line} strokeWidth="2" />

      <text x={L} y="320" fontSize="36" fontWeight="600" fill={C.muted} letterSpacing="1">Level</text>
      <text x={L - 14} y="630" fontSize="340" fontWeight="700" fill={C.accent} letterSpacing="-12">{p.level}</text>

      <circle cx={L + 54} cy="760" r="54" fill={p.avatar_color || '#3B5BDB'} />
      <text x={L + 54} y="776" textAnchor="middle" fontSize="44" fontWeight="600" fill="#FFFFFF">{initials(name, null)}</text>
      <text x={L + 136} y="776" fontSize="48" fontWeight="600" fill={C.fg}>{short(name, 24)}</text>
      <line x1={L} x2={R} y1="870" y2="870" stroke={C.line} strokeWidth="2" />

      {rows.map(([k, v], i) => {
        const y = 962 + i * 108
        return (
          <g key={k}>
            <text x={L} y={y} fontSize="36" fill={C.muted}>{k}</text>
            <text x={R} y={y} textAnchor="end" fontSize="64" fontWeight="600" fill={C.fg}>{v}</text>
            {i < rows.length - 1 && <line x1={L} x2={R} y1={y + 42} y2={y + 42} stroke={C.line} strokeWidth="2" />}
          </g>
        )
      })}

      <text x={L} y="1282" fontSize="30" fill={C.muted}>{p.total_xp} XP in all</text>
    </svg>
  )
}
