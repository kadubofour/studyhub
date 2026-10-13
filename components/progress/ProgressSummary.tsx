import { Zap } from 'lucide-react'
import { StatStrip } from '@/components/ui/cards'
import type { XpSummary } from '@/lib/xp/rules'

const RING = 96
const STROKE = 8
const R = (RING - STROKE) / 2
const C = 2 * Math.PI * R

// The top of Progress, all in one card: the level as a ring with the way to the next one, the four study stats, and the last 14 days of XP
export function ProgressSummary({ xp, stats }: { xp: XpSummary | null; stats: { label: string; value: string }[] }) {
  const max = xp ? Math.max(1, ...xp.last14.map(d => d.xp)) : 1
  return (
    <section aria-label="Your progress" className="card space-y-5">
      <div className="grid items-center gap-5 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {xp && (
          <div className="flex items-center gap-4">
            <div data-testid="level-ring" aria-hidden="true" className="relative flex shrink-0 items-center justify-center text-3xl font-semibold" style={{ width: RING, height: RING }}>
              <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className="absolute inset-0 -rotate-90">
                <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="var(--surface)" strokeWidth={STROKE} />
                <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="var(--accent-solid)" strokeWidth={STROKE} strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - xp.level.into / xp.level.span)} />
              </svg>
              {xp.level.level}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2"><span className="flex items-center gap-1.5 text-lg font-semibold"><Zap size={16} className="text-accent" aria-hidden />Level {xp.level.level}</span><span className="text-sm text-muted">{xp.total} XP</span></div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label={`Progress to level ${xp.level.level + 1}`}
                aria-valuenow={xp.level.into} aria-valuemin={0} aria-valuemax={xp.level.span} aria-valuetext={`${xp.level.into} of ${xp.level.span} XP`}>
                <div className="h-2.5 rounded-full bg-accent-solid" style={{ width: `${Math.round((xp.level.into / xp.level.span) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">{xp.level.into} of {xp.level.span} XP to level {xp.level.level + 1}</p>
            </div>
          </div>
        )}
        <div className={xp ? '' : 'md:col-span-2'}><StatStrip label="Study stats" items={stats} columns={2} /></div>
      </div>
      {xp && (
        <div className="border-t border-line pt-4">
          <h2 className="mb-2 text-sm font-medium">XP, last 14 days</h2>
          <div className="flex h-20 items-end gap-1" role="img" aria-label={`XP per day, last 14 days. ${xp.last14.map(d => `${d.day}: ${d.xp} XP`).join('; ')}`}>
            {xp.last14.map(d => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.xp} XP`}>
                <div className="w-full rounded-md bg-accent-solid" style={{ height: `${(d.xp / max) * 56}px`, minHeight: d.xp ? 2 : 0 }} />
                <span className="text-[10px] text-muted">{Number(d.day.slice(8))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
