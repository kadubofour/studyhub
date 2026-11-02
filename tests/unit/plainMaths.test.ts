import { describe, expect, it } from 'vitest'
import { cleanLesson, plainMaths } from '@/lib/lesson/script'

describe('plainMaths: a lesson shows maths as plain text, never LaTeX', () => {
  it.each([
    ['$x^2 + 1$', 'x² + 1'],
    ['a \\in A and b \\notin B', 'a ∈ A and b ∉ B'],
    ['A \\subseteq B, A \\cup B, A \\cap B', 'A ⊆ B, A ∪ B, A ∩ B'],
    ['\\frac{1}{2} of \\frac{x+1}{y}', '1/2 of (x+1)/y'],
    ['\\sqrt{2} and \\sqrt{x+1}', '√2 and √(x+1)'],
    ['H_2O and CO_{2}', 'H₂O and CO₂'],
    ['x_{10} and a^{n+1}', 'x₁₀ and aⁿ⁺¹'],
    ['x_{ab}', 'x_(ab)'],
    ['\\text{speed} = \\frac{d}{t}', 'speed = d/t'],
    ['a \\neq b, \\pi \\approx 3.14, \\infty', 'a ≠ b, π ≈ 3.14, ∞'],
    ['\\(x\\) and \\[y\\]', 'x and y'],
  ])('%s → %s', (raw, plain) => expect(plainMaths(raw)).toBe(plain))
  it('leaves plain text alone', () => {
    expect(plainMaths('6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂')).toBe('6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂')
    expect(plainMaths('The Krebs cycle')).toBe('The Krebs cycle')
  })
  it('is applied to every element and narration of a lesson', () => {
    const l = cleanLesson({
      title: 'Sets',
      elements: [{ id: 'a', kind: 'text', x: 50, y: 10, w: 0, h: 6, x2: 0, y2: 0, text: '$A \\subseteq B$', color: 'accent' }],
      steps: [{ narration: 'We write $a \\in A$.', show: ['a'], focus: ['a'] }, { narration: 'Done.', show: [], focus: [] }],
    })
    expect(l.elements[0].text).toBe('A ⊆ B')
    expect(l.steps[0].narration).toBe('We write a ∈ A.')
  })
})
