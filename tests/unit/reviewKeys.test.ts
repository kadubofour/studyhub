import { describe, it, expect } from 'vitest'
import { reviewKeyAction } from '@/lib/ui/reviewKeys'

describe('reviewKeyAction', () => {
  it('space reveals when hidden', () => {
    expect(reviewKeyAction({ key: ' ', repeat: false }, false, false)).toEqual({ type: 'reveal' })
  })
  it('1-4 rate only after reveal', () => {
    expect(reviewKeyAction({ key: '3', repeat: false }, false, false)).toBeNull()
    expect(reviewKeyAction({ key: '3', repeat: false }, true, false)).toEqual({ type: 'rate', rating: 3 })
  })
  it('ignores held keys (auto-repeat) so one press rates one card', () => {
    expect(reviewKeyAction({ key: '3', repeat: true }, true, false)).toBeNull()
    expect(reviewKeyAction({ key: ' ', repeat: true }, false, false)).toBeNull()
  })
  it('ignores input while a rating is saving', () => {
    expect(reviewKeyAction({ key: '4', repeat: false }, true, true)).toBeNull()
  })
  it('space after reveal does nothing', () => {
    expect(reviewKeyAction({ key: ' ', repeat: false }, true, false)).toBeNull()
  })
})
