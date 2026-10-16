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

/** The shortest and longest session a student can set */
export const MIN_MINUTES = 1
export const MAX_MINUTES = 180

export function pauseTimer(s: TimerState, now: number): TimerState {
  if (s.startedAt === null) return s
  return { ...s, startedAt: null, accumulatedMs: s.accumulatedMs + (now - s.startedAt) }
}

/** Starts the current session over from the full time: still running if it was running, still stopped if it was stopped */
export function restartTimer(s: TimerState, now: number): TimerState {
  const running = s.startedAt !== null
  return { ...createTimer(s.mode, s.durationMs), startedAt: running ? now : null, firstStartedAt: running ? now : null }
}

/** Whether there is anything to start over: some of the time has gone */
export function canRestart(s: TimerState, now: number): boolean {
  return elapsedMs(s, now) > 0
}

export function elapsedMs(s: TimerState, now: number): number {
  const running = s.startedAt === null ? 0 : Math.max(0, now - s.startedAt)
  return Math.min(s.durationMs, s.accumulatedMs + running)
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
