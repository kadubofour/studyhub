import { describe, it, expect } from 'vitest'
import { checkAnswer, parseReviewMode } from '@/lib/ui/answerCheck'

describe('checkAnswer', () => {
  it('is correct when it matches, ignoring capitals, spaces and punctuation', () => {
    expect(checkAnswer('Mitochondria', 'mitochondria').verdict).toBe('correct')
    expect(checkAnswer('  the  powerhouse, of the cell! ', 'The powerhouse of the cell.').verdict).toBe('correct')
  })
  it('ignores formatting marks and accents in the card', () => {
    expect(checkAnswer('adenosine triphosphate', '**Adenosine** triphosphate').verdict).toBe('correct')
    expect(checkAnswer('cafe', 'café').verdict).toBe('correct')
    expect(checkAnswer('x squared', '$x$ squared').verdict).toBe('correct')
  })
  it('is close for a slip on a short answer', () => {
    expect(checkAnswer('mitochondrion', 'mitochondria').verdict).toBe('close')
    expect(checkAnswer('ribosme', 'ribosome').verdict).toBe('close')
  })
  it('is close for a long answer with most of the words right, and different when few are', () => {
    const back = 'Glucose is broken down in glycolysis to make pyruvate and a little ATP'
    expect(checkAnswer('glucose is broken down in glycolysis to make pyruvate and some ATP', back).verdict).toBe('close')
    expect(checkAnswer('it happens in the nucleus', back).verdict).toBe('different')
  })
  it('does not call a short wrong answer close', () => {
    expect(checkAnswer('cat', 'dog').verdict).toBe('different')
    expect(checkAnswer('', 'dog').verdict).toBe('different')
  })
  it('keeps numbers exact', () => {
    expect(checkAnswer('42', '42').verdict).toBe('correct')
    expect(checkAnswer('43', '42').verdict).toBe('different')
    expect(checkAnswer('1914', '1941').verdict).toBe('different')
  })
  it('suggests Good, Hard or Again', () => {
    expect(checkAnswer('a', 'a').suggested).toBe(3)
    expect(checkAnswer('ribosme', 'ribosome').suggested).toBe(2)
    expect(checkAnswer('x', 'ribosome').suggested).toBe(1)
  })
})

describe('parseReviewMode', () => {
  it('is flip unless typing was chosen', () => {
    expect(parseReviewMode('type')).toBe('type')
    expect(parseReviewMode('flip')).toBe('flip')
    expect(parseReviewMode('nonsense')).toBe('flip')
    expect(parseReviewMode(null)).toBe('flip')
  })
})
