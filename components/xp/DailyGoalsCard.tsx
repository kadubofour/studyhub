import { Check, Circle } from 'lucide-react'
import type { XpSummary } from '@/lib/xp/rules'

const SHOW = { reviews: (v: number, t: number) => `${v} / ${t}`, focus: (v: number, t: number) => `${v} / ${t} min`, quiz: (v: number, t: number) => `${v} / ${t}` }

// Home: today's three goals, today's XP and the way to the next level
export function DailyGoalsCard({ xp }: { xp: XpSummary }) {
  const { level } = xp
  return (
    <section className="card" aria-labelledby="goals-title">
      <div className="flex items-baseline justify-between">
        <h2 id="goals-title" className="section-label">Daily goals</h2>
        <span className="text-sm font-medium">+{xp.today} XP today</span>
      </div>
      <ul className="space-y-1.5" aria-label="Daily goals">
        {xp.goals.map(g => (
          <li key={g.key} className="flex items-center gap-2 text-sm">
            {g.done ? <Check size={15} className="text-success" aria-hidden /> : <Circle size={15} className="text-muted" aria-hidden />}
            <span className={g.done ? 'text-muted line-through' : ''}>{g.label}</span>
            <span className="ml-auto text-muted">{SHOW[g.key](Math.min(g.value, 9999), g.target)}</span>
            {g.done && <span className="font-medium text-success">Done</span>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">{xp.allDone ? 'All three done, bonus earned' : `Finish all three for +${xp.bonus} XP`}</p>
      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label={`Progress to level ${level.level + 1}`}
          aria-valuenow={level.into} aria-valuemin={0} aria-valuemax={level.span}>
          <div className="h-2 rounded-full bg-accent-solid" style={{ width: `${Math.round((level.into / level.span) * 100)}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted">{level.into} of {level.span} XP to level {level.level + 1}</p>
      </div>
    </section>
  )
}
