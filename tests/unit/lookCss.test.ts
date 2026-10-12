import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { LOOKS, contrastRatio } from '@/lib/appearance'

const css = fs.readFileSync('app/globals.css', 'utf8').replace(/\r\n/g, '\n')
// The declarations inside the first rule whose selector is exactly `selector`
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start, `no rule for ${selector}`).toBeGreaterThanOrEqual(0)
  return css.slice(start, css.indexOf('}', start))
}
const value = (b: string, name: string) => new RegExp(`${name}:\\s*([^;]+);`, 'i').exec(b)?.[1].trim().toLowerCase()
const KEYS = ['bg', 'raised', 'surface', 'line', 'fg', 'muted'] as const

describe('globals.css matches LOOKS', () => {
  it.each([
    ['classic', 'light', ':root'], ['classic', 'dark', '.dark'],
    ['paper', 'light', '.app-root[data-look="paper"]'], ['paper', 'dark', '.dark .app-root[data-look="paper"]'], // dark Paper is Classic dark: before the page knows the theme there is no cream flash
    ['vivid', 'light', '.app-root[data-look="vivid"]'], ['vivid', 'dark', '.dark .app-root[data-look="vivid"]'],
    ['playful', 'light', '.app-root[data-look="playful"]'], ['playful', 'dark', '.dark .app-root[data-look="playful"]'],
  ] as const)('%s %s colours', (look, mode, selector) => {
    const b = block(selector)
    for (const k of KEYS) expect(value(b, `--${k}`), `${look} ${mode} --${k}`).toBe(LOOKS[look][mode][k].toLowerCase())
  })
  it.each(['vivid', 'playful'] as const)('%s tile tints match, in light and dark', look => {
    for (const [mode, selector] of [['light', `.app-root[data-look="${look}"]`], ['dark', `.dark .app-root[data-look="${look}"]`]] as const) {
      const b = block(selector)
      ;(['a', 'b', 'c'] as const).forEach((t, i) => expect(value(b, `--tile-${t}`), `${look} ${mode} tile ${t}`).toBe(LOOKS[look][mode].tiles[i].toLowerCase()))
    }
  })
  it.each(['vivid', 'playful'] as const)('%s sets the page background behind the app, in light and dark', look => {
    expect(css).toContain(`body:has(.app-root[data-look="${look}"])`)
    expect(css).toContain(`.dark body:has(.app-root[data-look="${look}"])`)
  })
  it('Classic tiles are the plain card colour in both modes, so Classic is unchanged', () => {
    for (const selector of [':root', '.dark']) {
      const b = block(selector)
      for (const t of ['a', 'b', 'c']) expect(value(b, `--tile-${t}`), `${selector} --tile-${t}`).toBe('var(--raised)')
    }
  })
  it('Paper light tile tints match', () => {
    const b = block('.app-root[data-look="paper"]')
    ;(['a', 'b', 'c'] as const).forEach((t, i) => expect(value(b, `--tile-${t}`)).toBe(LOOKS.paper.light.tiles[i].toLowerCase()))
  })
  it('defines the tile classes and a matching page background behind Paper', () => {
    for (const t of ['a', 'b', 'c']) expect(css).toContain(`.tile-${t} { background: var(--tile-${t}); }`)
    expect(css).toContain('body:has(.app-root[data-look="paper"])')
  })
})

describe('Vivid sidebar', () => {
  // The sidebar scopes its own text and line colours, so it must stay readable on its own background
  const light = block('.app-root[data-look="vivid"] .app-sidebar')
  const dark = block('.dark .app-root[data-look="vivid"] .app-sidebar')
  const bgOf = (b: string) => value(b, 'background')!.toUpperCase()
  const lum = (hex: string) => contrastRatio(hex, '#000000') // higher means lighter
  it('is darker than the page in both modes', () => {
    expect(lum(bgOf(light))).toBeLessThan(lum(LOOKS.vivid.light.bg))
    expect(lum(bgOf(dark))).toBeLessThan(lum(LOOKS.vivid.dark.bg))
  })
  it.each([['light', light, () => bgOf(light)], ['dark', dark, () => bgOf(dark)]] as const)('its text is readable on it (%s)', (_m, _b, bg) => {
    for (const token of ['--fg', '--muted', '--danger', '--success']) {
      expect(contrastRatio(value(light, token)!.toUpperCase(), bg()), token).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('is only the app sidebar, not every aside (the Study panel in a note is an aside too)', () => {
    expect(css).not.toMatch(/data-look="vivid"\] aside\s*[{,]/)
    expect(css).not.toMatch(/data-look="playful"\] aside\s*[{,]/)
    expect(light).toContain('color-scheme: dark')
  })
})

describe('Classic is the calm version of Vivid', () => {
  it('has the dark sidebar too, in both modes', () => {
    expect(css).toContain('.app-root[data-look="classic"] .app-sidebar')
    expect(css).toContain('.dark .app-root[data-look="classic"] .app-sidebar')
  })
  it('has the rounded shapes and pill buttons, in the components layer', () => {
    const layer = css.slice(css.indexOf('/* Vivid shapes'), css.indexOf('.prose-note h1 {'))
    for (const sel of ['.card', '.tile', '.btn', 'input.input', '.hero']) expect(layer, sel).toContain(`.app-root[data-look="classic"] ${sel}`)
  })
  it('stays calm: plain tiles, no glow under the main button, quieter section labels', () => {
    const layer = css.slice(css.indexOf('/* Classic shapes'), css.indexOf('/* Playful shapes'))
    expect(layer).not.toContain('color-mix')
    expect(layer).toMatch(/\.section-label \{ color: var\(--muted\)/)
  })
})

describe('look shapes sit below utilities', () => {
  it('are in the components layer, so a utility such as pl-9 or pr-12 still wins on an element', () => {
    expect(css).toMatch(/@layer components \{\s*\/\* Vivid shapes/)
    const start = css.indexOf('/* Vivid shapes')
    const end = css.indexOf('.prose-note h1 {')
    const layer = css.slice(start, end)
    expect(layer.trimEnd().endsWith('}')).toBe(true)
  })
  it('leave the padding of selects alone, which makes room for their chevron', () => {
    const rule = css.split(String.fromCharCode(10)).find(l => l.includes('data-look="vivid"] select.input') && l.includes('{'))
    expect(rule, 'vivid select rule').toBeTruthy()
    const body = rule!.slice(rule!.indexOf('{'))
    expect(body).not.toContain('padding')
  })
})

describe('printing', () => {
  it('resets Paper too, so a printed page is black on white whatever the look and theme', () => {
    const start = css.indexOf('@media print {')
    const printCss = css.slice(start, css.indexOf('\n}\n', start))
    expect(printCss).toContain('.app-root[data-look]')
    expect(printCss).toContain('.dark .app-root[data-look]')
    for (const t of ['a', 'b', 'c']) expect(printCss).toContain(`--tile-${t}`)
    expect(printCss).toContain('body:has(.app-root[data-look])')
    expect(printCss).toContain('.dark body:has(.app-root[data-look])')
  })
})
