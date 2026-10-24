import { describe, it, expect } from 'vitest'
import { isActive } from '@/lib/shell/nav'

describe('the place marked as current', () => {
  it('is Notes on a notebook\'s page, and Flashcards while reviewing', () => {
    expect(isActive('/notebooks/abc', '/notes')).toBe(true)
    expect(isActive('/review', '/flashcards')).toBe(true)
    expect(isActive('/notebooks/abc', '/library')).toBe(false)
  })
})
