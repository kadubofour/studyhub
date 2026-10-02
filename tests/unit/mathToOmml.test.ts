// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { latexToOmml } from '@/lib/export/mathToOmml'

const omml = (latex: string, display = false) => latexToOmml(latex, display)!

describe('latexToOmml (Word equations)', () => {
  it('wraps the result in an Office Math element', () => {
    expect(omml('x')).toMatch(/^<m:oMath[ >]/)
    expect(omml('x', true)).toMatch(/^<m:oMathPara[ >]/)
  })
  it('converts superscripts and subscripts', () => {
    const s = omml('x^2')
    expect(s).toContain('<m:sSup>')
    expect(s).toMatch(/<m:e>[\s\S]*<m:t[^>]*>x<\/m:t>[\s\S]*<\/m:e>/)
    expect(s).toMatch(/<m:sup>[\s\S]*<m:t[^>]*>2<\/m:t>[\s\S]*<\/m:sup>/)
    expect(omml('a_1')).toContain('<m:sSub>')
    expect(omml('a_i^2')).toContain('<m:sSubSup>')
  })
  it('converts fractions, roots and nth roots', () => {
    const f = omml('\\frac{a}{b}')
    expect(f).toContain('<m:f>')
    expect(f).toMatch(/<m:num>[\s\S]*a[\s\S]*<\/m:num>/)
    expect(f).toMatch(/<m:den>[\s\S]*b[\s\S]*<\/m:den>/)
    expect(omml('\\sqrt{x}')).toContain('<m:rad>')
    expect(omml('\\sqrt[3]{x}')).toMatch(/<m:deg>[\s\S]*3[\s\S]*<\/m:deg>/)
  })
  it('converts sums and integrals with limits to n-ary operators', () => {
    const s = omml('\\sum_{i=1}^{n} i', true)
    expect(s).toContain('<m:nary>')
    expect(s).toContain('m:val="∑"')
    expect(omml('\\int_0^1 x\\,dx', true)).toContain('m:val="∫"')
  })
  it('converts matrices', () => {
    expect(omml('\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}', true)).toContain('<m:m>')
  })
  it('handles the quadratic formula end to end', () => {
    const s = omml('x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}', true)
    for (const tag of ['<m:f>', '<m:rad>', '<m:sSup>']) expect(s).toContain(tag)
    expect(s).toContain('±')
  })
  it('escapes XML special characters', () => {
    expect(omml('a < b')).toContain('&lt;')
  })
  it('returns null for LaTeX it cannot parse, so the caller can fall back to text', () => {
    expect(latexToOmml('\\frac{', false)).toBeNull()
  })
})
