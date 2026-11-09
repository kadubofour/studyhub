import { describe, it, expect } from 'vitest'
import { EXPLAIN_MAX, explainMessage, quotePassage } from '@/lib/tutor/explainSelection'

describe('the question asked about selected text', () => {
  it('quotes the passage and says which note it is from', () => {
    expect(explainMessage('Krebs cycle', 'NADH carries electrons.')).toBe('Explain this from my note “Krebs cycle”, step by step, in simple terms:\n\n> NADH carries electrons.')
  })
  it('copes with a note with no title', () => {
    expect(explainMessage('  ', 'x y z')).toContain('from my note, step by step')
  })
  it('quotes every line of a passage, and tidies the spaces and blank lines', () => {
    expect(quotePassage('  one   two\n\n\n\nthree  ')).toBe('> one two\n>\n> three')
  })
  it('cuts a long passage at a word, and the whole message stays well under the limit', () => {
    const long = 'word '.repeat(2000)
    const q = quotePassage(long)
    expect(q.length).toBeLessThanOrEqual(EXPLAIN_MAX + 4)
    expect(q.endsWith('…')).toBe(true)
    expect(explainMessage('T'.repeat(500), long).length).toBeLessThan(3000)
  })
})
