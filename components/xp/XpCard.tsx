import { Flame, Trophy, Zap } from 'lucide-react'
import type { XpSummary } from '@/lib/xp/rules'

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

// Progress: level, total XP, streaks and the last 14 days
export function XpCard({ xp }: { xp: XpSummary }) {
  const { level } = xp
  const max = Math.max(1, ...xp.last14.map(d => d.xp))
  const alt = `XP per day, last 14 days. ${xp.last14.map(d => `${d.day}: ${d.xp} XP`).join('; ')}`
  return (
    <section className="card mb-4">
      <h2 className="mb-2 text-sm font-medium">XP</h2>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-2"><Zap size={16} className="text-accent" aria-hidden /><span className="text-lg font-semibold">Level {level.level}</span><span className="text-sm text-muted">{xp.total} XP</span></div>
        <div className="flex items-center gap-1.5 text-sm"><Flame size={14} className="text-[#D85A30]" aria-hidden /><span className="text-muted">Streak</span><span className="font-medium">{days(xp.streak)}</span></div>
        <div className="flex items-center gap-1.5 text-sm"><Trophy size={14} className="text-[#BA7517]" aria-hidden /><span className="text-muted">Best</span><span className="font-medium">{days(xp.best)}</span></div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label={`Progress to level ${level.level + 1}`}
        aria-valuenow={level.into} aria-valuemin={0} aria-valuemax={level.span}>
        <div className="h-2 rounded-full bg-accent-solid" style={{ width: `${Math.round((level.into / level.span) * 100)}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">{level.into} of {level.span} XP to level {level.level + 1}</p>
      <div className="mt-3 flex h-20 items-end gap-1" role="img" aria-label={alt}>
        {xp.last14.map(d => (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.xp} XP`}>
            <div className="w-full rounded-md bg-accent-solid" style={{ height: `${(d.xp / max) * 56}px`, minHeight: d.xp ? 2 : 0 }} />
            <span className="text-[10px] text-muted">{Number(d.day.slice(8))}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
