import type { Card } from './types'

export type Rating = 1 | 2 | 3 | 4
export interface SrsState { intervalDays: number; ease: number; reps: number; lapses: number; dueAt: string }

const DAY = 86_400_000
const MIN_EASE = 1.3
const AGAIN_DELAY_MS = 60_000
const round2 = (n: number) => Math.round(n * 100) / 100

export function schedule(s: SrsState, rating: Rating, now: Date): SrsState {
  if (rating === 1) {
    return {
      intervalDays: 0,
      ease: round2(Math.max(MIN_EASE, s.ease - 0.2)),
      reps: 0,
      lapses: s.reps > 0 ? s.lapses + 1 : s.lapses,
      dueAt: new Date(now.getTime() + AGAIN_DELAY_MS).toISOString(),
    }
  }
  const i = s.intervalDays
  const good = s.reps === 0 ? 1 : s.reps === 1 ? 6 : Math.max(i + 1, Math.round(i * s.ease))
  let ease = s.ease
  let interval: number
  if (rating === 2) {
    ease = Math.max(MIN_EASE, s.ease - 0.15)
    interval = s.reps === 0 ? 1 : Math.min(good, Math.max(i + 1, Math.round(i * 1.2)))
  } else if (rating === 3) {
    interval = good
  } else {
    ease = s.ease + 0.15
    interval = s.reps === 0 ? 4 : Math.max(good + 1, Math.round(good * 1.3))
  }
  return {
    intervalDays: interval,
    ease: round2(ease),
    reps: s.reps + 1,
    lapses: s.lapses,
    dueAt: new Date(now.getTime() + interval * DAY).toISOString(),
  }
}

export function cardToState(c: Card): SrsState {
  return { intervalDays: c.interval_days, ease: c.ease, reps: c.reps, lapses: c.lapses, dueAt: c.due_at }
}

export function stateToCardPatch(s: SrsState) {
  return { due_at: s.dueAt, interval_days: s.intervalDays, ease: s.ease, reps: s.reps, lapses: s.lapses }
}

export function formatInterval(ms: number): string {
  const min = ms / 60_000
  if (min < 1) return '<1m'
  if (min < 60) return `${Math.round(min)}m`
  const h = min / 60
  if (h < 24) return `${Math.round(h)}h`
  const d = h / 24
  if (d < 30) return `${Math.round(d)}d`
  if (d < 365) return `${Math.round(d / 30)}mo`
  return `${Math.round(d / 365)}y`
}

export function previewIntervals(s: SrsState, now: Date): Record<Rating, string> {
  const out = {} as Record<Rating, string>
  for (const r of [1, 2, 3, 4] as Rating[]) {
    out[r] = formatInterval(new Date(schedule(s, r, now).dueAt).getTime() - now.getTime())
  }
  return out
}
