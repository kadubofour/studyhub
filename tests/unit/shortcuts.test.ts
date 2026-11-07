import { describe, it, expect } from 'vitest'
import { GO_SHORTCUTS, GO_WINDOW_MS, isTyping, nextKey } from '@/lib/shell/shortcuts'

const press = (keys: [string, number][]) => keys.reduce((r, [k, at]) => nextKey(r.state, k, at), { state: { armedAt: null } as { armedAt: number | null } } as ReturnType<typeof nextKey>)

describe('keyboard shortcuts that go somewhere', () => {
  it('G then a letter goes to its place, in either case', () => {
    expect(press([['g', 0], ['p', 300]]).go).toBe('/planner')
    expect(press([['G', 0], ['C', 100]]).go).toBe('/courses')
  })
  it('a letter on its own does nothing', () => {
    expect(press([['p', 0]]).go).toBeUndefined()
  })
  it('the second key must come soon after the first', () => {
    expect(press([['g', 0], ['p', GO_WINDOW_MS + 1]]).go).toBeUndefined()
  })
  it('a letter that goes nowhere cancels the wait', () => {
    const r = press([['g', 0], ['z', 100], ['p', 200]])
    expect(r.go).toBeUndefined()
  })
  it('G then G is Progress', () => {
    expect(press([['g', 0], ['g', 100]]).go).toBe('/progress')
  })
  it('? asks for the list, at any time', () => {
    expect(press([['?', 0]]).help).toBe(true)
  })
  it('has no letter used twice, and every place is a real page', () => {
    expect(new Set(GO_SHORTCUTS.map(s => s.key)).size).toBe(GO_SHORTCUTS.length)
    expect(GO_SHORTCUTS.every(s => s.href.startsWith('/'))).toBe(true)
  })
  it('is not for typing: fields and editors keep their letters', () => {
    expect(isTyping({ tagName: 'INPUT', isContentEditable: false } as unknown as EventTarget)).toBe(true)
    expect(isTyping({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true)
    expect(isTyping({ tagName: 'DIV', isContentEditable: false, closest: () => null } as unknown as EventTarget)).toBe(false)
  })
})
