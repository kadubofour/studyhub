import { describe, it, expect } from 'vitest'
import { ACCENTS, FONTS, isAccent, isFont, contrastRatio } from '@/lib/appearance'

describe('accent presets', () => {
  it('offers the six agreed colours', () => {
    expect(Object.keys(ACCENTS)).toEqual(['blue', 'violet', 'teal', 'coral', 'pink', 'amber'])
  })
  it('keeps white button text readable on every accent (WCAG AA, 4.5:1)', () => {
    for (const [name, a] of Object.entries(ACCENTS)) {
      expect(contrastRatio(a.solid, '#ffffff'), name).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('keeps accent text readable on light and dark pages', () => {
    for (const [name, a] of Object.entries(ACCENTS)) {
      expect(contrastRatio(a.text, '#ffffff'), `${name} light`).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(a.textDark, '#141413'), `${name} dark`).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('validates names', () => {
    expect(isAccent('teal')).toBe(true)
    expect(isAccent('neon')).toBe(false)
  })
})

describe('font presets', () => {
  it('offers sans, rounded, serif, readable and mono', () => {
    expect(Object.keys(FONTS)).toEqual(['sans', 'rounded', 'serif', 'readable', 'mono'])
    expect(isFont('serif')).toBe(true)
    expect(isFont('comic')).toBe(false)
  })
})

describe('contrastRatio', () => {
  it('matches known values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })
})
