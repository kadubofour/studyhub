// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MarkdownView, isCaption, isProofMark } from '@/components/notes/MarkdownView'

vi.mock('@/lib/supabase/client', () => ({ supabase: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }))
afterEach(cleanup)

describe('isCaption', () => {
  it.each([['Open bounded interval', true], ['Venn diagram of U and H', true], ['cell', false], ['IMG_2041.png', false], ['my photo.jpg', false], ['', false]])('"%s" is %s', (alt, yes) => expect(isCaption(alt)).toBe(yes))
})
describe('isProofMark', () => {
  it.each([['■', true], [' □ ', true], ['∎', true], ['■ done', false], ['a', false], ['', false]])('"%s" is %s', (t, yes) => expect(isProofMark(t)).toBe(yes))
})

describe('MarkdownView', () => {
  it('puts the mark that ends a proof in a paragraph of its own style, and leaves other paragraphs alone', () => {
    const { container } = render(<MarkdownView source={'Then it holds.\n\n■\n\nNext part.'} />)
    const marks = container.querySelectorAll('p.end-of-proof')
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('■')
    expect(container.querySelectorAll('p')).toHaveLength(3)
  })
  it('draws an equation with a number in a display that can scroll', () => {
    const { container } = render(<MarkdownView source={'$$\n(a, b) = \\{x \\mid a < x < b\\}, \\tag{1.6}\n$$'} />)
    expect(container.querySelector('.katex-display .katex-tag')).not.toBeNull()
    expect(container.querySelector('.katex-error')).toBeNull()
  })
})
