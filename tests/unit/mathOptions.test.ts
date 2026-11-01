import katex from 'katex'
import { describe, expect, it } from 'vitest'
import { MATH_OPTIONS } from '@/components/notes/extensions'

const eq = 'A = \\{x \\mid x \\text{ has property } P\\}, \\tag{1.1}'

describe('equation numbers in the editor', () => {
  it('KaTeX refuses \\tag in inline maths without help (the red source seen in the editor)', () => {
    expect(katex.renderToString(eq, { throwOnError: false })).toContain('katex-error')
  })
  it('an inline equation with \\tag draws, with its number after it', () => {
    const html = katex.renderToString(eq, MATH_OPTIONS)
    expect(html).not.toContain('katex-error')
    expect(html).toContain('1.1')
  })
})
