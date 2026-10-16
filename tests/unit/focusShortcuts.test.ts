// @vitest-environment jsdom
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
  it('leaves the keys to a dialog or an open list on top of the page, but not to the full screen timer', () => {
    document.body.innerHTML = '<dialog open><button id="d">x</button></dialog><div role="listbox"><div role="option" id="o"></div></div><div role="dialog" aria-label="Full screen timer"><button id="f">p</button></div><button id="plain">y</button>'
    const at = (id: string) => ({ ...key('r'), target: document.getElementById(id) }) as unknown as KeyboardEvent
    expect(focusShortcut(at('d'))).toBeNull()
    expect(focusShortcut(at('o'))).toBeNull()
    document.body.innerHTML = '<div role="dialog" aria-label="Full screen timer"><button id="f">p</button></div>'
    expect(focusShortcut(at('f'))).toBe('restart') // the timer's own full screen view
    document.body.innerHTML = '<dialog open></dialog><button id="plain">y</button>'
    expect(focusShortcut(at('plain'))).toBeNull() // a dialog is open somewhere
    document.body.innerHTML = '<button id="plain">y</button>'
    expect(focusShortcut(at('plain'))).toBe('restart')
  })
  it('leaves browser shortcuts alone, and held keys', () => {
    expect(focusShortcut(key('r', { ctrl: true }))).toBeNull() // reload
    expect(focusShortcut(key('s', { meta: true }))).toBeNull() // save
    expect(focusShortcut(key('f', { alt: true }))).toBeNull()
    expect(focusShortcut(key(' ', { repeat: true }))).toBeNull()
  })
})
