import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { LOOKS, contrastRatio, effectiveLook, lookChoices, lookOf } from '@/lib/appearance'

const css = fs.readFileSync('app/globals.css', 'utf8').replace(/\r\n/g, '\n')
// The declarations inside the first rule whose selector is exactly `selector`
function block(selector: string): string {
  const start = css.indexOf(`\n${selector} {`)
  expect(start, `no rule for ${selector}`).toBeGreaterThanOrEqual(0)
  return css.slice(start, css.indexOf('}', start))
}
const value = (b: string, name: string) => new RegExp(`${name}:\\s*([^;]+);`, 'i').exec(b)?.[1].trim().toLowerCase()
const KEYS = ['bg', 'raised', 'surface', 'line', 'fg', 'muted'] as const
const OLD = ['classic', 'paper', 'vivid', 'playful'] as const

describe('the looks', () => {
  it('are Studio first, then Classic, Paper, Vivid and Playful', () => {
    expect(Object.keys(LOOKS)).toEqual(['studio', 'classic', 'paper', 'vivid', 'playful'])
  })
  it('an old cached profile, or a look this version does not know, shows Studio', () => {
    expect(lookOf(undefined)).toBe('studio')
    expect(lookOf('neon')).toBe('studio')
    expect(lookOf('vivid')).toBe('vivid')
  })
  it('Paper is still light only: Classic in dark mode, and not offered there', () => {
    expect(effectiveLook('paper', 'dark')).toBe('classic')
    expect(lookChoices('dark')).not.toContain('paper')
    expect(lookChoices('light')).toEqual(['studio', 'classic', 'paper', 'vivid', 'playful'])
  })
  it('every look keeps its text readable on its page, panels and soft surface', () => {
    for (const [name, look] of Object.entries(LOOKS)) for (const mode of ['light', 'dark'] as const) {
      const c = look[mode]
      for (const back of [c.bg, c.raised, c.surface]) {
        expect(contrastRatio(c.fg, back), `${name} ${mode} text`).toBeGreaterThanOrEqual(7)
        expect(contrastRatio(c.muted, back), `${name} ${mode} quiet text`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe('globals.css matches LOOKS', () => {
  it.each([
    ['studio', 'light', ':root'], ['studio', 'dark', '.dark'],
    ...OLD.flatMap(l => [[l, 'light', `.app-root[data-look="${l}"]`], [l, 'dark', `.dark .app-root[data-look="${l}"]`]]),
  ] as [keyof typeof LOOKS, 'light' | 'dark', string][])('%s %s colours', (look, mode, selector) => {
    const b = block(selector)
    for (const k of KEYS) expect(value(b, `--${k}`), `${look} ${mode} --${k}`).toBe(LOOKS[look][mode][k].toLowerCase())
  })
  it('the older looks are flat: solid panels instead of glass, and no aurora', () => {
    const b = block('.app-root[data-look]:not([data-look="studio"])')
    expect(value(b, '--glass')).toBe('var(--raised)')
    expect(value(b, '--glass-strong')).toBe('var(--raised)')
    expect(value(b, '--edge')).toBe('transparent')
    expect(value(b, 'background-image')).toBe('none')
  })
  it('the older looks fill buttons with the soft surface, as they did', () => {
    expect(css).toMatch(/:not\(\[data-look="studio"\]\) \.btn \{[^}]*background: var\(--surface\)/)
  })
  it('only Studio turns tinted tiles to glass: Vivid and Playful keep their colours', () => {
    expect(css).toContain('.app-root[data-look="studio"] [data-tint] {')
    expect(css).not.toMatch(/\n\[data-tint\] \{/)
  })
  it.each(['paper', 'vivid', 'playful'] as const)('%s sets the page background behind the app, in light and dark', look => {
    expect(css).toContain(`body:has(.app-root[data-look="${look}"])`)
    expect(css).toContain(`.dark body:has(.app-root[data-look="${look}"])`)
  })
})

describe('the dark sidebars of Classic and Vivid', () => {
  it.each([
    ['classic light', '.app-root[data-look="classic"] .app-sidebar', null],
    ['classic dark', '.dark .app-root[data-look="paper"] .app-sidebar,\n.dark .app-root[data-look="classic"] .app-sidebar', '.app-root[data-look="classic"] .app-sidebar'],
    ['vivid light', '.app-root[data-look="vivid"] .app-sidebar', null],
    ['vivid dark', '.dark .app-root[data-look="vivid"] .app-sidebar', '.app-root[data-look="vivid"] .app-sidebar'],
  ] as const)('%s: its text is readable on it', (_n, sel, base) => {
    const b = block(sel)
    const from = (t: string) => (value(b, t) ?? value(block(base!), t))!.toUpperCase()
    for (const t of ['--fg', '--muted']) expect(contrastRatio(from(t), from('background')), t).toBeGreaterThanOrEqual(4.5)
  })
  it('the sidebar takes its background from a class, so a look can colour it', () => {
    expect(block('.app-sidebar')).toContain('background: var(--glass)')
  })
})
