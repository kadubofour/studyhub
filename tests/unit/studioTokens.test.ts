import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { ACCENTS, contrastRatio } from '@/lib/appearance'

const css = fs.readFileSync('app/globals.css', 'utf8').replace(/\r\n/g, '\n')
// The declarations inside the first rule whose selector is exactly `selector`
function block(selector: string): string {
  const start = css.indexOf(`\n${selector} {`)
  expect(start, `no rule for ${selector}`).toBeGreaterThanOrEqual(0)
  return css.slice(start, css.indexOf('}', start))
}
const value = (b: string, name: string) => new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(b)?.[1].toLowerCase()

describe('the Studio colours', () => {
  for (const [mode, sel] of [['light', ':root'], ['dark', '.dark']] as const) {
    it(`${mode}: text and quiet text can be read on the page, on raised panels and on the soft surface`, () => {
      const b = block(sel)
      const [bg, raised, surface, fg, muted] = ['bg', 'raised', 'surface', 'fg', 'muted'].map(k => value(b, k)!)
      for (const back of [bg, raised, surface]) {
        expect(contrastRatio(fg, back), `text on ${back}`).toBeGreaterThanOrEqual(7)
        expect(contrastRatio(muted, back), `quiet text on ${back}`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
  it('dark is a midnight ink, not a grey near-black', () => {
    const bg = value(block('.dark'), 'bg')!
    const [r, g, b] = [1, 3, 5].map(i => parseInt(bg.slice(i, i + 2), 16))
    expect(b).toBeGreaterThan(r) // blue leaning
    expect(b).toBeGreaterThan(g)
  })
  it('every accent\'s button text is readable on its solid colour', () => {
    for (const [name, a] of Object.entries(ACCENTS)) expect(contrastRatio('#ffffff', a.solid), name).toBeGreaterThanOrEqual(4.5)
  })
})

describe('surfaces', () => {
  it('panels, tiles and the hero are glass with a lit top edge', () => {
    for (const sel of ['.card', '.tile', '.hero']) {
      const rule = css.match(new RegExp(`\\s\\${sel} \\{[^}]*\\}`))![0]
      expect(rule, sel).toContain('var(--glass)')
      expect(rule, sel).toContain('inset 0 1px 0 var(--edge)')
    }
  })
  it('the page is flat in every look but Studio, and the hero is a flat panel', () => {
    expect(block('.app-root')).not.toContain('gradient')
    expect(css).not.toContain('--aurora-strength')
    expect(css.match(/\s\.hero \{[^}]*\}/)![0]).not.toContain('radial-gradient')
    // the only radial glows are Studio's
    const glows = css.split('\n').filter(l => l.includes('radial-gradient('))
    expect(glows.length).toBeGreaterThan(0)
    const studio = block('.app-root[data-look="studio"]')
    for (const g of glows) expect(studio).toContain(g.trim().replace(/,$/, '').replace(/;$/, ''))
  })
  it('every look sets its own colours; :root and .dark keep Studio\'s for the pages outside the app (sign in, onboarding)', () => {
    for (const look of ['classic', 'studio', 'paper', 'vivid', 'playful']) expect(css).toContain(`\n.app-root[data-look="${look}"] {`)
  })
})

describe('section titles', () => {
  it('are short headings in the display face, never all-caps eyebrows', () => {
    const rule = css.match(/\s\.section-label \{[^}]*\}/)![0]
    expect(rule).toContain('var(--display-font)')
    expect(rule).not.toContain('uppercase')
  })
})

describe('no-scrollbar', () => {
  it('hides the scrollbar in every browser while leaving the area scrollable', () => {
    expect(css).toMatch(/\.no-scrollbar \{[^}]*scrollbar-width: none/)
    expect(css).toMatch(/\.no-scrollbar::-webkit-scrollbar \{[^}]*display: none/)
  })
})

describe('printing', () => {
  it('is black on white whatever the theme: glass, edges and the aurora are reset', () => {
    const start = css.indexOf('@media print {')
    const printCss = css.slice(start, css.indexOf('\n}\n', start))
    for (const t of ['--glass: #fff', '--glass-strong: #fff', '--edge: transparent', '--shadow: none']) expect(printCss).toContain(t)
    expect(printCss).toMatch(/\.app-root \{ background-image: none; \}/)
  })
})

describe('the Home hero', () => {
  it('is the old ruled notebook page in the accent, with white text, in every look', () => {
    const rule = css.match(/\.hero-page \{[^}]*\}/)![0]
    expect(rule).toContain('background-color: var(--accent-solid)')
    expect(rule).toContain('repeating-linear-gradient')
    expect(rule).toContain('color: #fff')
  })
})

describe('glow, kept low', () => {
  it('no shadow is coloured by the accent: buttons, panels and the hero cast plain shadows', () => {
    const shadows = css.match(/box-shadow:[^;]*;/g) ?? []
    expect(shadows.filter(s => /--accent-solid|--accent-glow/.test(s))).toEqual([])
  })
  it('the shell has no accent halos on the active item, the logo or the Create button', () => {
    const shell = fs.readFileSync('components/shell/AppShell.tsx', 'utf8')
    expect(shell).not.toMatch(/shadow-\[[^\]]*var\(--accent-solid\)\]/)
  })
})

describe('room on a phone', () => {
  it('the whole app is a little larger on a phone: text, spacing and tap targets grow together', () => {
    expect(css).toMatch(/@media \(max-width: 639px\) \{\s*html \{ font-size: 17px; \}/)
  })
})
