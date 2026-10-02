import type { TimerState } from '../timer'

export interface PersistedTimer { state: TimerState; completedFocus: number; dayKey: string }
// Per-user key so a shared device never hands one student's running session to another
const keyFor = (userId?: string) => (userId ? `studyhub.timer.${userId}` : 'studyhub.timer')

export function loadTimer(storage: Pick<Storage, 'getItem'>, userId?: string): PersistedTimer | null {
  try {
    const raw = storage.getItem(keyFor(userId))
    if (!raw) return null
    const v = JSON.parse(raw) as PersistedTimer
    const s = v?.state
    if (!s || !['focus', 'short', 'long'].includes(s.mode) || typeof s.durationMs !== 'number'
      || typeof v.completedFocus !== 'number' || typeof v.dayKey !== 'string') return null
    return v
  } catch {
    return null
  }
}

export function saveTimer(storage: Pick<Storage, 'setItem'>, t: PersistedTimer, userId?: string): void {
  try { storage.setItem(keyFor(userId), JSON.stringify(t)) } catch { /* storage unavailable: timer still works for this page view */ }
}

export function clearTimer(storage: Pick<Storage, 'removeItem'>, userId?: string): void {
  try { storage.removeItem(keyFor(userId)) } catch { /* ignore */ }
}
