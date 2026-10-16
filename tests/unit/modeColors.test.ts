import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MODE_COLORS, modeClass } from '@/lib/focus/modeColors'

const css = readFileSync('app/globals.css', 'utf8')
const channel = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255) }
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
const LIGHT = ['#fbfbfa', '#ffffff', '#f3f3f0'] // Classic's page, cards and wells
const DARK = ['#121211', '#1a1a19', '#222220']

describe('modeClass', () => {
  it('leaves focus in the student\'s accent, and names the breaks', () => {
    expect(modeClass('focus')).toBe('')
    expect(modeClass('short')).toBe('mode-short')
    expect(modeClass('long')).toBe('mode-long')
  })
})

describe('the session colours', () => {
  for (const [mode, c] of Object.entries(MODE_COLORS)) {
    it(`${mode}: white on its button colour, its text on the page and on its tint, in light and dark, can be read`, () => {
      expect(contrast('#ffffff', c.solid)).toBeGreaterThanOrEqual(4.5)
      for (const bg of LIGHT) expect(contrast(c.text, bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(c.text, c.soft)).toBeGreaterThanOrEqual(4.5)
      for (const bg of DARK) expect(contrast(c.textDark, bg)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(c.textDark, c.softDark)).toBeGreaterThanOrEqual(4.5)
    })

    it(`${mode}: globals.css gives the page the same colours`, () => {
      const rule = (re: RegExp) => css.match(re)?.[1] ?? ''
      const light = rule(new RegExp(`\\.mode-${mode}\\s*\\{([^}]*)\\}`))
      const dark = rule(new RegExp(`\\.dark \\.mode-${mode}\\s*\\{([^}]*)\\}`))
      expect(light).toContain(`--accent-solid: ${c.solid}`)
      expect(light).toContain(`--accent-glow: ${c.glow}`)
      expect(light).toContain(`--accent: ${c.text}`)
      expect(light).toContain(`--accent-soft: ${c.soft}`)
      expect(dark).toContain(`--accent: ${c.textDark}`)
      expect(dark).toContain(`--accent-soft: ${c.softDark}`)
    })
  }
})
