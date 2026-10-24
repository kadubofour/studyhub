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
const OLD = ['ink', 'classic', 'paper', 'vivid', 'playful'] as const

describe('the looks', () => {
  it('are Ink first, then Studio, Classic, Paper, Vivid and Playful', () => {
    expect(Object.keys(LOOKS)).toEqual(['ink', 'studio', 'classic', 'paper', 'vivid', 'playful'])
  })
  it('an old cached profile, or a look this version does not know, shows Ink', () => {
    expect(lookOf(undefined)).toBe('ink')
    expect(lookOf('neon')).toBe('ink')
    expect(lookOf('vivid')).toBe('vivid')
  })
  it('Paper is still light only: Classic in dark mode, and not offered there', () => {
    expect(effectiveLook('paper', 'dark')).toBe('classic')
    expect(lookChoices('dark')).not.toContain('paper')
    expect(lookChoices('light')).toEqual(['ink', 'studio', 'classic', 'paper', 'vivid', 'playful'])
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

describe('review fixes', () => {
  it.each(['.app-root[data-look="classic"] .app-sidebar', '.app-root[data-look="vivid"] .app-sidebar'])('%s re-declares the glass, so the rail tooltips are dark like the sidebar, not white', sel => {
    const b = block(sel)
    expect(value(b, '--glass')).toBe('var(--raised)')
    expect(value(b, '--glass-strong')).toBe('var(--raised)')
  })
  it.each(['.app-root[data-look="classic"]', '.dark .app-root[data-look="classic"]'])('%s sets its own tile colours, so no Studio glass tint shows on its chips', sel => {
    for (const t of ['a', 'b', 'c']) expect(value(block(sel), `--tile-${t}`)).toBe('var(--raised)')
  })
})

describe('Ink', () => {
  const ink = (sel: string) => css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{[^}]*\\}'))?.[0] ?? ''
  it('main buttons are ink pills: the text colour as the fill, the page colour as the text, no glow', () => {
    const b = ink('.app-root[data-look="ink"] .btn-primary')
    expect(b).toContain('background: var(--fg)')
    expect(b).toContain('color: var(--bg)')
    expect(b).toContain('border-radius: 9999px')
    expect(b).toContain('box-shadow: none')
  })
  it('other buttons are white pills with a hairline', () => {
    const b = ink('.app-root[data-look="ink"] .btn')
    expect(b).toContain('background: var(--raised)')
    expect(b).toContain('border: 1px solid var(--line)')
    expect(b).toContain('border-radius: 9999px')
  })
  it('cards are flat: white, a hairline and no shadow', () => {
    const c = ink('.app-root[data-look="ink"] :is(.card, .tile)')
    expect(c).toContain('box-shadow: none')
    expect(c).toContain('border: 1px solid var(--line)')
  })
  it('selected chips and list items are a warm grey with ink text, not tinted with the accent', () => {
    expect(value(block('.app-root[data-look="ink"]'), '--accent-soft')).toBe('#ebe8de')
    expect(value(block('.app-root[data-look="ink"]'), '--accent')).toBe('var(--fg)')
    expect(value(block('.dark .app-root[data-look="ink"]'), '--accent-soft')).toBe('#2f2f2d')
    expect(value(block('.dark .app-root[data-look="ink"]'), '--accent')).toBe('var(--fg)')
  })
  it('titles are set in a serif', () => {
    expect(block('.app-root[data-look="ink"]')).toContain('--title-font: var(--font-newsreader)')
  })
  it.each(['light', 'dark'])('the sidebar is dark and readable in %s mode, with a lighter pill for the current place', mode => {
    const b = block(mode === 'light' ? '.app-root[data-look="ink"] .app-sidebar' : '.dark .app-root[data-look="ink"] .app-sidebar')
    const base = block('.app-root[data-look="ink"] .app-sidebar')
    const v = (t: string) => (value(b, t) ?? value(base, t))!.toUpperCase()
    for (const t of ['--fg', '--muted']) expect(contrastRatio(v(t), v('background')), t).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#FFFFFF', v('--accent-soft'))).toBeGreaterThanOrEqual(7)
  })
})
