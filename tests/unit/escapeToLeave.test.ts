import { describe, it, expect } from 'vitest'
import { shouldLeaveOnEscape } from '@/lib/ui/escapeToLeave'

const ev = (over: Partial<{ key: string; isComposing: boolean; defaultPrevented: boolean; keyCode: number }> = {}) =>
  ({ key: 'Escape', isComposing: false, defaultPrevented: false, keyCode: 27, ...over })

describe('shouldLeaveOnEscape', () => {
  it('leaves on a plain Escape', () => {
    expect(shouldLeaveOnEscape(ev(), false)).toBe(true)
  })
  it('stays while an input method is composing (cancelling a Chinese/Japanese/Korean candidate)', () => {
    expect(shouldLeaveOnEscape(ev({ isComposing: true }), false)).toBe(false)
    expect(shouldLeaveOnEscape(ev({ keyCode: 229 }), false)).toBe(false)
  })
  it('stays when a menu already handled it or a dialog is open', () => {
    expect(shouldLeaveOnEscape(ev({ defaultPrevented: true }), false)).toBe(false)
    expect(shouldLeaveOnEscape(ev(), true)).toBe(false)
  })
  it('leaves from inside the note editor, which marks every Esc handled without using it', () => {
    expect(shouldLeaveOnEscape(ev({ defaultPrevented: true }), false, true)).toBe(true)
    expect(shouldLeaveOnEscape(ev({ defaultPrevented: true, isComposing: true }), false, true)).toBe(false)
    expect(shouldLeaveOnEscape(ev({ defaultPrevented: true }), true, true)).toBe(false)
  })
  it('ignores other keys', () => {
    expect(shouldLeaveOnEscape(ev({ key: 'Enter' }), false)).toBe(false)
  })
})
