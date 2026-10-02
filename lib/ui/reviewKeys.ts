import type { Rating } from '../srs'

export function reviewKeyAction(
  e: { key: string; repeat: boolean }, revealed: boolean, busy: boolean,
): { type: 'reveal' } | { type: 'rate'; rating: Rating } | null {
  if (e.repeat || busy) return null
  if (!revealed) return e.key === ' ' || e.key === 'Enter' ? { type: 'reveal' } : null
  if (['1', '2', '3', '4'].includes(e.key)) return { type: 'rate', rating: Number(e.key) as Rating }
  return null
}
