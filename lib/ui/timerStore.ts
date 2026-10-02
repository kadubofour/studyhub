import type { TimerState } from '../timer'

export interface PersistedTimer { state: TimerState; completedFocus: number; dayKey: string }
const KEY = 'studyhub.timer'

export function loadTimer(storage: Pick<Storage, 'getItem'>): PersistedTimer | null {
  try {
    const raw = storage.getItem(KEY)
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

export function saveTimer(storage: Pick<Storage, 'setItem'>, t: PersistedTimer): void {
  try { storage.setItem(KEY, JSON.stringify(t)) } catch { /* storage unavailable: timer still works for this page view */ }
}
