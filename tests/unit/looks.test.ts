import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { LOOKS, contrastRatio, effectiveLook, lookChoices, lookOf } from '@/lib/appearance'

// Every look is built on one system (docs/superpowers/specs/2026-11-01-ink-look-design.md); each keeps its own colours and character
const css = fs.readFileSync('app/globals.css', 'utf8').replace(/\r\n/g, '\n')
// The declarations inside the first rule whose selector is exactly `selector`
function block(selector: string): string {
  const start = css.indexOf(`\n${selector} {`)
  expect(start, `no rule for ${selector}`).toBeGreaterThanOrEqual(0)
  return css.slice(start, css.indexOf('}', start))
}
const value = (b: string, name: string) => new RegExp(`${name}:\\s*([^;]+);`, 'i').exec(b)?.[1].trim().toLowerCase()
const rule = (sel: string) => css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{[^}]*\\}'))?.[0] ?? ''
const KEYS = ['bg', 'raised', 'surface', 'line', 'fg', 'muted'] as const
const NAMES = ['classic', 'studio', 'paper', 'vivid', 'playful'] as const

describe('the looks', () => {
  it('are Classic first, then Studio, Paper, Vivid and Playful', () => {
    expect(Object.keys(LOOKS)).toEqual([...NAMES])
  })
  it('an old cached profile, or a look this version does not know (Ink included), shows Classic', () => {
    expect(lookOf(undefined)).toBe('classic')
    expect(lookOf('ink')).toBe('classic')
    expect(lookOf('vivid')).toBe('vivid')
  })
  it('Paper is still light only: Classic in dark mode, and not offered there', () => {
    expect(effectiveLook('paper', 'dark')).toBe('classic')
    expect(lookChoices('dark')).toEqual(['classic', 'studio', 'vivid', 'playful'])
    expect(lookChoices('light')).toEqual([...NAMES])
  })
  it('Classic is the paper and ink of the redesign', () => {
    expect(LOOKS.classic.light).toMatchObject({ bg: '#F7F6F0', raised: '#FFFFFF', fg: '#191918' })
  })
  it('every look keeps its text readable on its page, panels, soft surface and tiles', () => {
    for (const [name, look] of Object.entries(LOOKS)) for (const mode of ['light', 'dark'] as const) {
      const c = look[mode]
      for (const back of [c.bg, c.raised, c.surface]) {
        expect(contrastRatio(c.fg, back), `${name} ${mode} text`).toBeGreaterThanOrEqual(7)
        expect(contrastRatio(c.muted, back), `${name} ${mode} quiet text`).toBeGreaterThanOrEqual(4.5)
      }
      for (const tile of c.tiles) expect(contrastRatio(c.muted, tile), `${name} ${mode} quiet text on ${tile}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('globals.css matches LOOKS', () => {
  it.each(NAMES.flatMap(l => [[l, 'light', `.app-root[data-look="${l}"]`], [l, 'dark', `.dark .app-root[data-look="${l}"]`]]) as [keyof typeof LOOKS, 'light' | 'dark', string][])('%s %s colours', (look, mode, selector) => {
    const b = block(selector)
    for (const k of KEYS) expect(value(b, `--${k}`), `${look} ${mode} --${k}`).toBe(LOOKS[look][mode][k].toLowerCase())
    ;(['a', 'b', 'c'] as const).forEach((t, i) => expect(value(b, `--tile-${t}`), `${look} ${mode} tile ${t}`).toBe(LOOKS[look][mode].tiles[i].toLowerCase()))
  })
  it.each(NAMES)('%s sets the page behind the app, in light and dark', look => {
    expect(css).toContain(`body:has(.app-root[data-look="${look}"])`)
    expect(css).toContain(`.dark body:has(.app-root[data-look="${look}"])`)
  })
  it('no look is glass, glows or washes the page with the accent', () => {
    const b = block('.app-root[data-look]')
    expect(value(b, '--glass')).toBe('var(--raised)')
    expect(value(b, '--glass-strong')).toBe('var(--raised)')
    expect(value(b, '--edge')).toBe('transparent')
    expect(value(b, 'background-image')).toBe('none')
    expect(css).not.toContain(':not([data-look="studio"])')
  })
})

describe('the shared system', () => {
  it('main buttons are pills, by default filled with the text colour', () => {
    const b = rule('.app-root[data-look] .btn-primary')
    expect(b).toContain('background: var(--fg)')
    expect(b).toContain('color: var(--bg)')
    expect(b).toContain('border-radius: 9999px')
    expect(b).toContain('box-shadow: none')
  })
  it('other buttons are raised pills with a hairline', () => {
    const b = rule('.app-root[data-look] .btn')
    expect(b).toContain('background: var(--raised)')
    expect(b).toContain('border: 1px solid var(--line)')
    expect(b).toContain('border-radius: 9999px')
  })
  it('cards are flat: raised, a hairline and no shadow', () => {
    const c = rule('.app-root[data-look] :is(.card, .tile)')
    expect(c).toContain('box-shadow: none')
    expect(c).toContain('border: 1px solid var(--line)')
  })
  it('every sidebar item is a pill', () => {
    expect(rule('.app-root[data-look] .app-sidebar :is(a, button):not([role="menuitem"])')).toContain('border-radius: 9999px')
  })
})

describe('each look keeps its character', () => {
  it.each([['classic', 'newsreader'], ['studio', 'instrument'], ['paper', 'lora'], ['vivid', 'instrument'], ['playful', 'nunito']])('%s titles are set in %s', (look, face) => {
    expect(value(block(`.app-root[data-look="${look}"]`), '--title-font')).toBe(`var(--font-${face})`)
  })
  it.each(['classic', 'studio', 'paper'])('%s selection is a quiet tint with text-coloured text', look => {
    expect(value(block(`.app-root[data-look="${look}"]`), '--accent')).toBe('var(--fg)')
    expect(value(block(`.dark .app-root[data-look="${look}"]`), '--accent')).toBe('var(--fg)')
  })
  it.each(['vivid', 'playful'])('%s fills the main button with the student\'s colour, and keeps colour on selection', look => {
    expect(rule(`.app-root[data-look="${look}"] .btn-primary`)).toContain('background: var(--accent-solid)')
    expect(value(block(`.app-root[data-look="${look}"]`), '--accent')).toBeUndefined()
  })
  it('Playful has thick outlines and buttons that press down', () => {
    expect(rule('.app-root[data-look="playful"] :is(.card, .tile)')).toContain('border-width: 2px')
    expect(css).toMatch(/data-look="playful"\] \.btn-primary:active[^{]*\{[^}]*translateY\(2px\)/)
  })
})

describe('the dark sidebar of every look', () => {
  it.each(NAMES.flatMap(l => [[l, 'light'], [l, 'dark']]))('%s, %s mode: its text is readable on it, and the current place stands out', (look, mode) => {
    const base = block(`.app-root[data-look="${look}"] .app-sidebar`)
    const b = mode === 'dark' && css.includes(`\n.dark .app-root[data-look="${look}"] .app-sidebar {`) ? block(`.dark .app-root[data-look="${look}"] .app-sidebar`) : base
    const v = (t: string) => (value(b, t) ?? value(base, t))!.toUpperCase()
    for (const t of ['--fg', '--muted']) expect(contrastRatio(v(t), v('background')), t).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(v('--fg'), v('--accent-soft')), 'the current place').toBeGreaterThanOrEqual(7)
    expect(value(base, '--glass-strong')).toBe('var(--raised)') // its tooltips are dark too
  })
})
