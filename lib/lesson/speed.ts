import { localStore, useLocalStore } from '@/lib/ui/localStore'

export const SPEED_MIN = 0.5
export const SPEED_MAX = 2
export const SPEED_STEP = 0.25

export function parseSpeed(stored: unknown): number {
  const n = typeof stored === 'number' ? stored : NaN
  return n >= SPEED_MIN && n <= SPEED_MAX && Number.isInteger(n / SPEED_STEP) ? n : 1
}

/** How fast lessons play: the voice, and the drawing with it. Kept on this device. */
export const lessonSpeed = localStore<number>('studyhub.lesson.speed', 1, parseSpeed)
export const useLessonSpeed = () => useLocalStore(lessonSpeed)
