import { describe, it, expect } from 'vitest'
import { focusShortcut } from '@/lib/focus/shortcuts'

const key = (k: string, o: { target?: Partial<HTMLElement> & { tagName?: string; isContentEditable?: boolean; getAttribute?: (n: string) => string | null }; ctrl?: boolean; meta?: boolean; alt?: boolean; repeat?: boolean } = {}) =>
  ({ key: k, ctrlKey: !!o.ctrl, metaKey: !!o.meta, altKey: !!o.alt, repeat: !!o.repeat, target: o.target ?? { tagName: 'BODY', isContentEditable: false, getAttribute: () => null } }) as unknown as KeyboardEvent

describe('focusShortcut', () => {
  it('maps the keys', () => {
    expect(focusShortcut(key(' '))).toBe('toggle')
    expect(focusShortcut(key('r'))).toBe('restart')
    expect(focusShortcut(key('R'))).toBe('restart')
    expect(focusShortcut(key('s'))).toBe('skip')
    expect(focusShortcut(key('f'))).toBe('fullscreen')
    expect(focusShortcut(key('x'))).toBeNull()
  })
  const on = (tagName: string, role: string | null = null, isContentEditable = false) => ({ tagName, isContentEditable, getAttribute: (n: string) => (n === 'role' ? role : null) })
  it('leaves every key alone while typing', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) for (const k of [' ', 'r', 's', 'f']) expect(focusShortcut(key(k, { target: on(tagName) }))).toBeNull()
    expect(focusShortcut(key('r', { target: on('DIV', null, true) }))).toBeNull()
    expect(focusShortcut(key('r', { target: on('DIV', 'textbox') }))).toBeNull()
  })
  it('leaves Space to buttons and switches, but the letters still work after clicking one', () => {
    for (const t of [on('BUTTON'), on('A'), on('DIV', 'switch'), on('DIV', 'tab')]) {
      expect(focusShortcut(key(' ', { target: t }))).toBeNull()
      expect(focusShortcut(key('r', { target: t }))).toBe('restart')
    }
  })
  it('works from a drum, which uses neither Space nor the letters', () => {
    expect(focusShortcut(key(' ', { target: on('DIV', 'spinbutton') }))).toBe('toggle')
  })
  it('leaves browser shortcuts alone, and held keys', () => {
    expect(focusShortcut(key('r', { ctrl: true }))).toBeNull() // reload
    expect(focusShortcut(key('s', { meta: true }))).toBeNull() // save
    expect(focusShortcut(key('f', { alt: true }))).toBeNull()
    expect(focusShortcut(key(' ', { repeat: true }))).toBeNull()
  })
})
