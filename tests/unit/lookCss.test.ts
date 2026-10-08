import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { LOOKS } from '@/lib/appearance'

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
    ['paper', 'light', '.app-root[data-look="paper"]'], ['paper', 'dark', '.dark .app-root[data-look="paper"]'],
  ] as const)('%s %s colours', (look, mode, selector) => {
    const b = block(selector)
    for (const k of KEYS) expect(value(b, `--${k}`), `${look} ${mode} --${k}`).toBe(LOOKS[look][mode][k].toLowerCase())
  })
  it('Paper tile tints match, in light and dark', () => {
    for (const [mode, selector] of [['light', '.app-root[data-look="paper"]'], ['dark', '.dark .app-root[data-look="paper"]']] as const) {
      const b = block(selector)
      ;(['a', 'b', 'c'] as const).forEach((t, i) => expect(value(b, `--tile-${t}`), `${mode} tile ${t}`).toBe(LOOKS.paper[mode].tiles[i].toLowerCase()))
    }
  })
  it('Classic tiles are the plain card colour in both modes, so Classic is unchanged', () => {
    for (const selector of [':root', '.dark']) {
      const b = block(selector)
      for (const t of ['a', 'b', 'c']) expect(value(b, `--tile-${t}`), `${selector} --tile-${t}`).toBe('var(--raised)')
    }
  })
  it('defines the tile classes and a matching page background behind Paper', () => {
    for (const t of ['a', 'b', 'c']) expect(css).toContain(`.tile-${t} { background: var(--tile-${t}); }`)
    expect(css).toContain('body:has(.app-root[data-look="paper"])')
  })
})
