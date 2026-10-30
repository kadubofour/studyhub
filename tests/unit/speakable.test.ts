import { describe, it, expect } from 'vitest'
import { speakable, speechChunks } from '@/lib/tutor/speakable'

describe('a reply as words to say', () => {
  it('drops Markdown marks, keeps the words', () => {
    expect(speakable('## The Krebs cycle\n\nIt happens in the **mitochondrial matrix** and makes *NADH*.')).toBe('The Krebs cycle.\nIt happens in the mitochondrial matrix and makes NADH.')
    expect(speakable('- First step\n- Second step\n1. Then this')).toBe('First step\nSecond step\nThen this')
    expect(speakable('See [your note](/notes/1) and `ATP`.')).toBe('See your note and ATP.')
  })
  it('says simple maths in words', () => {
    expect(speakable('So $x^2 + 1$ and $$\\frac{a}{b}$$')).toBe('So x squared + 1 and a over b.')
    expect(speakable('$\\sqrt{9} \\times 2$')).toBe('the square root of 9 times 2')
  })
  it('leaves code out, and reads a table\'s cells', () => {
    expect(speakable('Run:\n```js\nconsole.log(1)\n```\ndone')).toBe('Run:\n (a code example) \ndone'.replace(/[ \t]+/g, ' ').trim())
    expect(speakable('| Part | Job |\n|---|---|\n| Matrix | Krebs |')).toContain('Matrix , Krebs')
  })
})

describe('reading in pieces', () => {
  it('keeps short text whole, and cuts long text after sentences', () => {
    expect(speechChunks('One. Two.')).toEqual(['One. Two.'])
    const long = Array.from({ length: 20 }, (_, i) => `Sentence number ${i} is here.`).join(' ')
    const pieces = speechChunks(long, 100)
    expect(pieces.length).toBeGreaterThan(3)
    expect(pieces.every(p => p.length <= 100 && /\.$/.test(p))).toBe(true)
    expect(pieces.join(' ')).toBe(long)
  })
  it('cuts a very long sentence at a space', () => {
    const pieces = speechChunks('word '.repeat(100).trim(), 50)
    expect(pieces.every(p => p.length <= 50)).toBe(true)
    expect(pieces.join(' ')).toBe('word '.repeat(100).trim())
  })
})
