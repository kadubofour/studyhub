import { describe, it, expect } from 'vitest'
import { pageTitle } from '@/lib/shell/titles'

describe('pageTitle', () => {
  it('names a page by its place, whatever is inside it', () => {
    expect(pageTitle('/library')).toBe('Library · Studyhub')
    expect(pageTitle('/progress')).toBe('Progress · Studyhub')
    expect(pageTitle('/notes/n1')).toBe('Studyhub')
    expect(pageTitle('/flashcards/d1')).toBe('Practice · Studyhub')
    expect(pageTitle('/review')).toBe('Review cards · Studyhub')
  })
  it('is just the app\'s name for a path it does not know', () => {
    expect(pageTitle('/somewhere-else')).toBe('Studyhub')
    expect(pageTitle('/librarian')).toBe('Studyhub') // not a page inside /library
  })
})
