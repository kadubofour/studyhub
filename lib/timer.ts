export type Mode = 'focus' | 'short' | 'long'
export interface TimerState {
  mode: Mode
  durationMs: number
  startedAt: number | null
  accumulatedMs: number
  firstStartedAt: number | null
  logged: boolean
}

export const MIN_LOG_MS = 5 * 60_000

export function createTimer(mode: Mode, durationMs: number): TimerState {
  return { mode, durationMs, startedAt: null, accumulatedMs: 0, firstStartedAt: null, logged: false }
}

export function startTimer(s: TimerState, now: number): TimerState {
  if (s.startedAt !== null) return s
  return { ...s, startedAt: now, firstStartedAt: s.firstStartedAt ?? now }
}

export function pauseTimer(s: TimerState, now: number): TimerState {
  if (s.startedAt === null) return s
  return { ...s, startedAt: null, accumulatedMs: s.accumulatedMs + (now - s.startedAt) }
}

export function elapsedMs(s: TimerState, now: number): number {
  return Math.min(s.durationMs, s.accumulatedMs + (s.startedAt === null ? 0 : now - s.startedAt))
}

export function remainingMs(s: TimerState, now: number): number {
  return Math.max(0, s.durationMs - elapsedMs(s, now))
}

export function isFinished(s: TimerState, now: number): boolean {
  return remainingMs(s, now) === 0
}

export function nextMode(mode: Mode, completedFocusCount: number, longBreakEvery: number): Mode {
  if (mode !== 'focus') return 'focus'
  return completedFocusCount > 0 && completedFocusCount % Math.max(1, longBreakEvery) === 0 ? 'long' : 'short'
}

export function shouldLogSession(s: TimerState, now: number): boolean {
  if (s.mode !== 'focus' || s.logged) return false
  return isFinished(s, now) || elapsedMs(s, now) >= MIN_LOG_MS
}

export function markLogged(s: TimerState): TimerState {
  return { ...s, logged: true }
}

export function durationFor(
  mode: Mode, p: { focus_minutes: number; short_break_minutes: number; long_break_minutes: number },
): number {
  const min = mode === 'focus' ? p.focus_minutes : mode === 'short' ? p.short_break_minutes : p.long_break_minutes
  return min * 60_000
}
