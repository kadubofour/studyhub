import { describe, it, expect } from 'vitest'
import { advanceQueue, RatingLedger } from '@/lib/ui/reviewQueue'
import type { Card } from '@/lib/types'

const card = (id: string): Card => ({ id, deck_id: 'd', front: id, back: id, due_at: '2026-10-01T00:00:00Z', interval_days: 0, ease: 2.5, reps: 0, lapses: 0 })

describe('advanceQueue', () => {
  it('removes the rated card by id, even if it is no longer at the head', () => {
    const [a, b, c] = [card('a'), card('b'), card('c')]
    // A was already rated and removed; a stale retry for A must not drop B
    expect(advanceQueue([b, c], a, a, 3).map(x => x.id)).toEqual(['b', 'c'])
  })
  it('requeues an Again card at the end', () => {
    const [a, b] = [card('a'), card('b')]
    const again = { ...a, reps: 0 }
    expect(advanceQueue([a, b], a, again, 1).map(x => x.id)).toEqual(['b', 'a'])
  })
})

describe('RatingLedger', () => {
  it('lets a retry through only if the card has not been rated since', () => {
    const l = new RatingLedger()
    const t1 = l.ticket('a')
    expect(l.isCurrent('a', t1)).toBe(true)
    l.recorded('a') // the user's second press succeeded
    expect(l.isCurrent('a', t1)).toBe(false) // the stale Retry must be ignored
    const t2 = l.ticket('a') // an Again card shown later can be rated again
    expect(l.isCurrent('a', t2)).toBe(true)
  })
})
