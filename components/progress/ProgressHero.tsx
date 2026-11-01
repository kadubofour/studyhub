import Link from 'next/link'
import { Check } from 'lucide-react'
import type { XpSummary } from '@/lib/xp/rules'
import { fmtMinutes, type Headline, type WeekDot } from '@/lib/progress/summary'

const RING = 84
const STROKE = 7
const R = (RING - STROKE) / 2
const C = 2 * Math.PI * R

// The top of Progress: how the student is doing in a sentence, their level, and this week day by day, on a soft panel.
// A student with nothing yet is invited in, not shown a row of zeros.
export function ProgressHero({ xp, headline, dots, todayMinutes, goalMinutes }: {
  xp: XpSummary | null; headline: Headline; dots: WeekDot[]; todayMinutes: number; goalMinutes: number
}) {
  const met = dots.filter(d => d.state === 'met').length
  const active = dots.filter(d => d.state === 'met' || d.state === 'some').length
  return (
    <section aria-label="Your progress" className="card space-y-5" style={{ background: 'color-mix(in srgb, var(--accent-solid) 6%, var(--raised))' }}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        {xp && (
          <div className="flex items-center gap-4">
            <div data-testid="level-ring" aria-hidden="true" className="relative flex shrink-0 items-center justify-center text-[1.6rem] font-semibold" style={{ width: RING, height: RING }}>
              <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className="absolute inset-0 -rotate-90">
                <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="var(--line)" strokeWidth={STROKE} />
                <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="var(--accent-solid)" strokeOpacity={0.85} strokeWidth={STROKE} strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - xp.level.into / xp.level.span)} />
              </svg>
              {xp.level.level}
            </div>
            <div className="min-w-[8.5rem]">
              <p className="text-base font-semibold">Level {xp.level.level} <span className="text-sm font-normal text-muted">{xp.total} XP</span></p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label={`Progress to level ${xp.level.level + 1}`}
                aria-valuenow={xp.level.into} aria-valuemin={0} aria-valuemax={xp.level.span} aria-valuetext={`${xp.level.into} of ${xp.level.span} XP`}>
                <div className="h-2 rounded-full" style={{ width: `${Math.round((xp.level.into / xp.level.span) * 100)}%`, background: 'color-mix(in srgb, var(--accent-solid) 80%, transparent)' }} />
              </div>
              <p className="mt-1 text-xs text-muted">{xp.level.into} of {xp.level.span} XP to level {xp.level.level + 1}</p>
            </div>
          </div>
        )}
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="font-display text-[1.6rem] font-semibold leading-tight tracking-tight">{headline.title}</h2>
          <p className="mt-1 text-[15px] text-muted">{headline.line}</p>
        </div>
        <Link href="/focus" className="btn-primary">Start focus</Link>
      </div>

      <div className="flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-line pt-4">
        <div>
          <h3 className="mb-2 text-sm font-medium">This week <span className="font-normal text-muted">· {active === 0 ? 'a fresh week' : `${active} of 7 days${met > 0 ? `, goal reached on ${met}` : ''}`}</span></h3>
          <ul aria-label="This week" className="flex gap-2">
            {dots.map(d => (
              <li key={d.key} aria-label={`${d.name}: ${d.state === 'met' ? 'goal reached' : d.state === 'some' ? `${fmtMinutes(d.minutes)} of focus` : d.state === 'future' ? 'still to come' : 'no focus'}`}
                className="flex flex-col items-center gap-1">
                <span aria-hidden className={`grid size-9 place-items-center rounded-full text-[13px] font-medium ${d.isToday ? 'ring-2 ring-offset-2 ring-offset-[var(--raised)]' : ''}`}
                  style={{
                    background: d.state === 'met' ? 'color-mix(in srgb, var(--accent-solid) 80%, transparent)' : d.state === 'some' ? 'color-mix(in srgb, var(--accent-solid) 26%, transparent)' : 'transparent',
                    color: d.state === 'met' ? '#fff' : undefined, border: d.state === 'none' || d.state === 'future' ? '1.5px dashed var(--line)' : 'none',
                    ['--tw-ring-color' as string]: 'var(--accent-solid)',
                  }}>
                  {d.state === 'met' ? <Check size={16} strokeWidth={3} /> : <span className={d.state === 'future' ? 'text-muted' : ''}>{d.letter}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {goalMinutes > 0 && (
          <div className="min-w-48 flex-1">
            <h3 className="mb-2 text-sm font-medium">Today <span className="font-normal text-muted">· {fmtMinutes(todayMinutes)} of {fmtMinutes(goalMinutes)}</span></h3>
            <div role="progressbar" aria-label="Today's focus goal" aria-valuemin={0} aria-valuemax={goalMinutes} aria-valuenow={Math.min(todayMinutes, goalMinutes)}
              aria-valuetext={`${fmtMinutes(todayMinutes)} of ${fmtMinutes(goalMinutes)}`} className="h-2.5 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.round((todayMinutes / goalMinutes) * 100))}%`, background: 'color-mix(in srgb, var(--accent-solid) 80%, transparent)' }} />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
