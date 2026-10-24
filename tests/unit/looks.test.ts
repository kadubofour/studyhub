import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { LOOKS, contrastRatio, effectiveLook, lookChoices, lookOf } from '@/lib/appearance'

// Every look is built on one system (docs/superpowers/specs/2026-11-01-ink-look-design.md); each keeps its own colours and character
const css = fs.readFileSync('app/globals.css', 'utf8').replace(/\r\n/g, '\n')
// The declarations inside the first rule whose selector is exactly `selector` (a rule may list a twin after it: see the last test)
function block(selector: string): string {
  const at = [' {', ',\n'].map(end => css.indexOf(`\n${selector}${end}`)).filter(i => i >= 0)
  expect(at.length, `no rule for ${selector}`).toBeGreaterThan(0)
  const start = Math.min(...at)
  return css.slice(css.indexOf('{', start), css.indexOf('}', start))
}
const value = (b: string, name: string) => new RegExp(`${name}:\\s*([^;]+);`, 'i').exec(b)?.[1].trim().toLowerCase()
const rule = (sel: string) => css.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(,[^{]*)? \\{[^}]*\\}'))?.[0] ?? ''
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
  it('Classic\'s soft surface is a warm grey, not the cream of another brand', () => {
    expect(LOOKS.classic.light.surface).toBe('#EFEEEA')
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
  it('Playful is sunny and bold: dark outlines, solid offset shadows, and buttons that press into them', () => {
    expect(LOOKS.playful.light.bg).toBe('#FFF7E8')
    const card = rule('.app-root[data-look="playful"] :is(.card, .tile)')
    expect(card).toContain('border: 2px solid var(--outline)')
    expect(card).toContain('box-shadow: 4px 4px 0 var(--outline)')
    expect(rule('.app-root[data-look="playful"] :is(.btn, .btn-primary, .btn-danger)')).toContain('box-shadow: 3px 3px 0 var(--outline)')
    expect(css).toMatch(/data-look="playful"\] :is\(\.btn, \.btn-primary, \.btn-danger\):active[^{]*\{[^}]*translate\(3px, 3px\)[^}]*box-shadow: none/)
    expect(value(block('.app-root[data-look="playful"]'), '--outline')).toBe('#2b2a33')
  })
  it('Playful fields have a soft border that turns bold while typing, so a card is not outlined twice', () => {
    const f = rule('.app-root[data-look="playful"] .field input')
    expect(f).toContain('border: 2px solid var(--line)')
    expect(css).toMatch(/data-look="playful"\] \.field input:focus[^{]*\{[^}]*border-color: var\(--outline\)/)
  })
  it('Playful outlines stand out from its page in light and dark', () => {
    expect(contrastRatio('#2B2A33', LOOKS.playful.light.bg)).toBeGreaterThanOrEqual(3)
    const dark = value(block('.dark .app-root[data-look="playful"]'), '--outline')!.toUpperCase()
    expect(contrastRatio(dark, LOOKS.playful.dark.bg)).toBeGreaterThanOrEqual(3) // lavender by night, so the outlines still read
  })
})

describe('the sidebar of every look', () => {
  // Classic, Studio, Paper and Vivid set it on the page ground (lessGeneric.test.tsx); its current place is the look's quiet pill
  it.each([['classic', 'light'], ['classic', 'dark'], ['studio', 'light'], ['studio', 'dark'], ['paper', 'light']] as const)('%s, %s mode: the current place stands out', (look, mode) => {
    const b = block(mode === 'dark' ? `.dark .app-root[data-look="${look}"]` : `.app-root[data-look="${look}"]`)
    expect(contrastRatio(LOOKS[look][mode].fg, value(b, '--accent-soft')!.toUpperCase())).toBeGreaterThanOrEqual(7)
  })
  it.each(['light', 'dark'])('Playful, %s mode: its text is readable on its purple, and the current place stands out', mode => {
    const base = block('.app-root[data-look="playful"] .app-sidebar')
    const b = mode === 'dark' ? block('.dark .app-root[data-look="playful"] .app-sidebar') : base
    const v = (t: string) => (value(b, t) ?? value(base, t))!.toUpperCase()
    for (const t of ['--fg', '--muted']) expect(contrastRatio(v(t), v('background')), t).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(v('--fg'), v('--accent-soft')), 'the current place').toBeGreaterThanOrEqual(7)
    expect(value(base, '--glass-strong')).toBe('var(--raised)')
  })
})

describe('a look drawn inside another (the previews in Settings)', () => {
  it('every rule a look sets on what is inside it has a twin for a look nested in the app, so a preview shows its own look', () => {
    const selectors = [...css.matchAll(/(^|\})\s*([^{}@]+)\{/g)].flatMap(m => m[2].split(',').map(s => s.trim()))
    // a look's own rules, and the ones every look shares: a nested look must win over the outer look's own
    const own = selectors.filter(s => /^(\.dark )?\.app-root\[data-look(="\w+")?\] .+/.test(s))
    expect(own.length).toBeGreaterThan(20)
    for (const s of own) {
      const twin = s.replace(/^(\.dark )?\.app-root\[/, (_m, d) => `${d ?? ''}.app-root .app-root[`)
      expect(selectors, s).toContain(twin)
    }
  })
})

describe('Studio is ethereal', () => {
  const studio = () => block('.app-root[data-look="studio"]')
  it('is a soft colour wash with no shapes: the page shifts from the accent at the top to the second colour lower down', () => {
    const b = studio()
    expect(b).toMatch(/background-image:\s*linear-gradient\(to bottom, color-mix\(in srgb, var\(--accent-solid\) [^;]*color-mix\(in srgb, var\(--accent-glow\)[^;]*\);/)
    expect(b.split('gradient(').length - 1).toBe(1) // one wash, nothing else
    for (const shape of ['radial-gradient(', 'conic-gradient(']) expect(b).not.toContain(shape) // no blobs (Focus's) and no rays
    expect(value(b, 'background-attachment')).toBe('fixed')
  })
  it('its top bar is frosted too, so the light from above is not cut off under it', () => {
    expect(fs.readFileSync('components/shell/TopBar.tsx', 'utf8')).toContain('className="app-topbar no-print sticky top-0')
    const t = rule('.app-root[data-look="studio"] .app-topbar')
    expect(t).toContain('background: color-mix(in srgb, var(--bg) 55%, transparent)')
    expect(t).toContain('backdrop-filter: blur(24px)')
  })
  it('glows more by night than by day, and never loud', () => {
    const day = Number(value(studio(), '--glow')!.replace('%', ''))
    const night = Number(value(block('.dark .app-root[data-look="studio"]'), '--glow')!.replace('%', ''))
    expect(day).toBeLessThanOrEqual(26)
    expect(night).toBeGreaterThan(day)
    expect(night).toBeLessThanOrEqual(48)
  })
  it('its cards are frosted, so the glow shows softly through them; the other looks stay flat', () => {
    const c = rule('.app-root[data-look="studio"] :is(.card, .tile)')
    expect(c).toContain('background: color-mix(in srgb, var(--raised) 74%, transparent)')
    expect(c).toContain('backdrop-filter: blur(20px) saturate(1.2)')
    expect(rule('.app-root[data-look] :is(.glass, .card, .tile, .hero, .menu-panel, .app-sidebar)')).toContain('backdrop-filter: none')
  })
})

describe('Studio around a note', () => {
  it('an open note keeps the plain page, with no wash behind the writing', () => {
    expect(fs.readFileSync('app/(app)/notes/[id]/page.tsx', 'utf8')).toContain('<div data-note-page className=')
    expect(rule('.app-root[data-look="studio"]:has([data-note-page])')).toContain('background-image: none')
  })
})

describe('the Focus page in every look', () => {
  it('its Start button wears the session\'s own colour (focus, short break, long break), not the look\'s ink', () => {
    expect(fs.readFileSync('app/(app)/focus/page.tsx', 'utf8')).toContain('className="btn-primary btn-mode ')
    const r = rule('.app-root[data-look] .btn-primary.btn-mode')
    expect(r).toContain('background: var(--accent-solid)')
    expect(r).toContain('color: #fff')
  })
})
