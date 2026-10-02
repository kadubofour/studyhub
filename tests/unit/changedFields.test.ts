import { describe, it, expect } from 'vitest'
import { changedFields } from '@/lib/ui/changedFields'

describe('changedFields', () => {
  it('returns only the fields the user edited', () => {
    const initial = { theme: 'light', focus_minutes: 25, display_name: 'Ama' }
    const form = { theme: 'light', focus_minutes: 30, display_name: 'Ama' }
    expect(changedFields(initial, form)).toEqual({ focus_minutes: 30 })
  })
  it('leaves untouched fields out so a change made elsewhere (e.g. the sidebar theme) is not overwritten', () => {
    expect(changedFields({ theme: 'light' }, { theme: 'light' })).toEqual({})
  })
})
