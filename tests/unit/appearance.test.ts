import { describe, it, expect } from 'vitest'
import { CONTENT_WIDTHS, contentWidthOf, ACCENTS, FONTS, LOOKS, contrastRatio, effectiveLook, greetingFont, isAccent, isFont, isLook, lookChoices, lookOf } from '@/lib/appearance'

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

describe('looks', () => {
  it('offers Classic, Paper, Vivid and Playful', () => {
    expect(Object.keys(LOOKS)).toEqual(['classic', 'paper', 'vivid', 'playful'])
    expect(isLook('paper')).toBe(true)
    expect(isLook('vivid')).toBe(true)
    expect(isLook('playful')).toBe(true)
    expect(isLook('neon')).toBe(false)
  })
  it('falls back to Classic for a missing or unknown look', () => {
    expect(lookOf(undefined)).toBe('classic')
    expect(lookOf('neon')).toBe('classic')
    expect(lookOf('paper')).toBe('paper')
    expect(lookOf('vivid')).toBe('vivid')
  })
  it.each(Object.entries(LOOKS))('%s: text is readable on its backgrounds, light and dark (WCAG AA)', (name, look) => {
    for (const mode of ['light', 'dark'] as const) {
      const c = look[mode]
      for (const bg of [c.bg, c.raised, c.surface]) expect(contrastRatio(c.fg, bg), `${name} ${mode} fg on ${bg}`).toBeGreaterThanOrEqual(4.5)
      for (const bg of [c.bg, c.raised, ...c.tiles]) expect(contrastRatio(c.muted, bg), `${name} ${mode} muted on ${bg}`).toBeGreaterThanOrEqual(4.5)
      for (const tile of c.tiles) expect(contrastRatio(c.fg, tile), `${name} ${mode} fg on tile ${tile}`).toBeGreaterThanOrEqual(4.5)
    }
  })
  it.each(Object.entries(LOOKS))('%s: every accent stays readable on its backgrounds', (name, look) => {
    for (const [accent, a] of Object.entries(ACCENTS)) {
      for (const bg of [look.light.bg, look.light.raised]) expect(contrastRatio(a.text, bg), `${name} ${accent} light on ${bg}`).toBeGreaterThanOrEqual(4.5)
      for (const bg of [look.dark.bg, look.dark.raised]) expect(contrastRatio(a.textDark, bg), `${name} ${accent} dark on ${bg}`).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('Paper is for light mode only: in dark mode it shows as Classic, and is not offered', () => {
    expect(effectiveLook('paper', 'dark')).toBe('classic')
    expect(effectiveLook('paper', 'light')).toBe('paper')
    expect(effectiveLook('paper', undefined)).toBe('paper')
    for (const l of ['classic', 'vivid', 'playful']) expect(effectiveLook(l, 'dark')).toBe(l)
    expect(lookChoices('dark')).toEqual(['classic', 'vivid', 'playful'])
    expect(lookChoices('light')).toEqual(['classic', 'paper', 'vivid', 'playful'])
  })
  it('Paper dark colours are Classic dark, so nothing cream shows in dark mode', () => {
    expect(LOOKS.paper.dark).toEqual(LOOKS.classic.dark)
  })
  it('the serif greeting is only for Paper while the font is the default Sans', () => {
    expect(greetingFont('paper', 'sans')).toBe('var(--font-lora)')
    expect(greetingFont('paper', 'rounded')).toBeUndefined()
    expect(greetingFont('classic', 'sans')).toBeUndefined()
    expect(greetingFont(undefined, undefined)).toBeUndefined()
  })
})

describe('content width', () => {
  it('offers focused, wide and full, wide being the default', () => {
    expect(CONTENT_WIDTHS.map(w => w.id)).toEqual(['focused', 'wide', 'full'])
    expect(contentWidthOf('full')).toBe('full')
    expect(contentWidthOf('focused')).toBe('focused')
    expect(contentWidthOf('huge')).toBe('wide')
    expect(contentWidthOf(undefined)).toBe('wide')
  })
})
