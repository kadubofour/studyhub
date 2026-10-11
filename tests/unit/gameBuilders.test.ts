import { describe, it, expect } from 'vitest'
import { buildMatch, buildSpeed, shuffle, MIN_CARDS, type GCard } from '@/lib/games/build'

const cards = (n: number): GCard[] => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, front: `front ${i}`, back: `back ${i}` }))
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

describe('shuffle', () => {
  it('keeps every item and does not change the input', () => {
    const xs = [1, 2, 3, 4, 5]
    const out = shuffle(xs, seeded())
    expect([...out].sort()).toEqual(xs)
    expect(xs).toEqual([1, 2, 3, 4, 5])
  })
})

describe('buildMatch', () => {
  it('uses at most six cards and each at most once', () => {
    const m = buildMatch(cards(20), seeded())
    expect(m).toHaveLength(6)
    expect(new Set(m.map(c => c.id)).size).toBe(6)
  })
  it('uses every card of a small deck', () => { expect(buildMatch(cards(4), seeded())).toHaveLength(4) })
  it('leaves out cards that repeat another card’s front or back, so a pair is never ambiguous', () => {
    const cs = [...cards(5), { id: 'dupBack', front: 'other', back: 'back 0' }, { id: 'dupFront', front: 'front 1', back: 'unique' }]
    for (let seed = 1; seed <= 20; seed++) {
      const m = buildMatch(cs, seeded(seed))
      expect(new Set(m.map(c => c.back)).size).toBe(m.length)
      expect(new Set(m.map(c => c.front)).size).toBe(m.length)
    }
  })
  it('knows the smallest deck it works with', () => { expect(MIN_CARDS).toBe(4) })
})

describe('buildSpeed', () => {
  it('asks up to ten questions with four different options including the right back', () => {
    const qs = buildSpeed(cards(30), seeded())
    expect(qs).toHaveLength(10)
    for (const q of qs) {
      expect(q.options).toHaveLength(4)
      expect(new Set(q.options).size).toBe(4)
      expect(q.options).toContain(q.answer)
      expect(q.answer).toBe(cards(30).find(c => c.id === q.card.id)!.back)
    }
  })
  it('asks each card once', () => {
    const qs = buildSpeed(cards(12), seeded())
    expect(new Set(qs.map(q => q.card.id)).size).toBe(qs.length)
  })
  it('never offers a wrong option that reads the same as the answer, ignoring case and spacing', () => {
    const cs = [...cards(5), { id: 'twin', front: 'f', back: '  BACK 0 ' }]
    for (const q of buildSpeed(cs, seeded())) {
      const same = q.options.filter(o => o.trim().toLowerCase() === q.answer.trim().toLowerCase())
      expect(same).toHaveLength(1)
    }
  })
  it('never offers another card with the same front as a wrong answer', () => {
    const cs: GCard[] = [{ id: 'a', front: 'Synonym of happy', back: 'glad' }, { id: 'b', front: 'synonym of happy ', back: 'joyful' }, ...cards(4)]
    for (let seed = 1; seed <= 30; seed++) {
      for (const q of buildSpeed(cs, seeded(seed))) {
        if (q.card.id === 'a') expect(q.options).not.toContain('joyful')
        if (q.card.id === 'b') expect(q.options).not.toContain('glad')
      }
    }
  })
  it('skips a card when the deck cannot supply three different wrong answers', () => {
    const cs: GCard[] = [{ id: 'a', front: 'a', back: 'x' }, { id: 'b', front: 'b', back: 'x' }, { id: 'c', front: 'c', back: 'x' }, { id: 'd', front: 'd', back: 'y' }]
    expect(buildSpeed(cs, seeded())).toEqual([])
  })
})
