import { describe, it, expect } from 'vitest'
import { canGoBack, visit } from '@/lib/ui/backStack'

describe('the pages a back button can lead to', () => {
  it('has nowhere to go back to on the first page', () => {
    expect(canGoBack(visit([], '/home'))).toBe(false)
  })
  it('adds each new page, and a reload of the same page changes nothing', () => {
    const s = visit(visit([], '/home'), '/library')
    expect(s).toEqual(['/home', '/library'])
    expect(visit(s, '/library')).toBe(s)
    expect(canGoBack(s)).toBe(true)
  })
  it('going back to the page before drops the page left', () => {
    expect(visit(['/home', '/library', '/notes/1'], '/library')).toEqual(['/home', '/library'])
  })
  it('a page reached by a link, not by going back, is a step forward even if seen before', () => {
    expect(visit(['/home', '/library', '/notes/1'], '/home')).toEqual(['/home', '/library', '/notes/1', '/home'])
  })
  it('keeps only the latest fifty pages', () => {
    let s: string[] = []
    for (let i = 0; i < 80; i++) s = visit(s, `/p/${i}`)
    expect(s).toHaveLength(50)
    expect(s.at(-1)).toBe('/p/79')
  })
})
