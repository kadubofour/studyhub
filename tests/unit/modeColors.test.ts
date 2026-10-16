import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MODE_COLORS, modeClass } from '@/lib/focus/modeColors'
import { ACCENTS } from '@/lib/appearance'

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

const hue = (hex: string) => {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b)
  if (d === 0) return 0
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return (h * 60 + 360) % 360
}
const apart = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d) }

describe('the break colours are not colours a student can pick as their accent', () => {
  for (const [mode, c] of Object.entries(MODE_COLORS)) {
    it(`${mode}: a different colour from every accent, by at least 25 degrees of hue`, () => {
      for (const [name, a] of Object.entries(ACCENTS)) {
        expect(c.solid.toLowerCase()).not.toBe(a.solid.toLowerCase())
        expect(apart(hue(c.solid), hue(a.solid)), `${mode} against ${name}`).toBeGreaterThanOrEqual(25)
      }
    })
  }
  it('and the two breaks differ from each other', () => {
    expect(apart(hue(MODE_COLORS.short.solid), hue(MODE_COLORS.long.solid))).toBeGreaterThanOrEqual(60)
  })
})

describe('the accent a student picked stays available on a break page', () => {
  it('app.css keeps it under its own names, which a break does not change', () => {
    expect(css).toMatch(/\.app-root\s*\{[^}]*--user-solid: var\(--a-solid\)[^}]*--user-glow: var\(--a-glow\)/)
    expect(css.match(/\.mode-(short|long)\s*\{[^}]*\}/g)!.join('')).not.toContain('--user-')
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
