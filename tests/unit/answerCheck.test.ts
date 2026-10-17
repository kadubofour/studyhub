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

describe('after the review', () => {
  const v = (a: string, b: string) => checkAnswer(a, b).verdict
  it('keeps signs, exponents, sub and superscripts, and Greek letters', () => {
    expect(v('-3', '3')).toBe('different')
    expect(v('10^-3', '10^3')).toBe('different')
    expect(v('H₂O₂', 'H₂O')).toBe('different')
    expect(v('x³', 'x²')).toBe('different')
    expect(v('β-helix', 'α-helix')).toBe('different')
    expect(v('H₂O', 'H2O')).toBe('correct')
    expect(v('3.5', '3.5')).toBe('correct')
    expect(v('3.5', '35')).toBe('different')
  })
  it('works for cards that are not in Latin letters', () => {
    expect(v('猫', '猫')).toBe('correct')
    expect(v('狗', '猫')).toBe('different')
    expect(v('Ω', 'Ω')).toBe('correct')
    expect(v('ø', 'o')).toBe('different')
    expect(v('привет', 'Привет!')).toBe('correct')
  })
  it('does not call opposites or confusable terms close', () => {
    expect(v('decreases', 'increases')).toBe('different')
    expect(v('meiosis', 'mitosis')).toBe('different')
    expect(v('50 km', '50 cm')).toBe('different')
    expect(v('the enzyme does denature', 'the enzyme does not denature')).toBe('different')
    expect(v('B causes A in the cell', 'A causes B in the cell')).toBe('different')
  })
  it('is still forgiving of a slip, and of a missing word in a long answer', () => {
    expect(v('ribosme', 'ribosome')).toBe('close')
    expect(v('mitochondrion', 'mitochondria')).toBe('close')
    expect(v("it doesn't change", 'it does not change')).toBe('correct')
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
