import { describe, it, expect } from 'vitest'
import { isActive } from '@/lib/shell/nav'

describe('the place marked as current', () => {
  it('is Library for everything inside it, and Flashcards while reviewing or on a quiz', () => {
    for (const path of ['/library', '/notes', '/notes/n1', '/notebooks/abc', '/lectures', '/lectures/l1', '/files/f1']) expect(isActive(path, '/library'), path).toBe(true)
    expect(isActive('/review', '/flashcards')).toBe(true)
    expect(isActive('/quiz/q1', '/flashcards')).toBe(true)
    expect(isActive('/tutor', '/library')).toBe(false)
    expect(isActive('/notebooks/abc', '/flashcards')).toBe(false)
  })
})
