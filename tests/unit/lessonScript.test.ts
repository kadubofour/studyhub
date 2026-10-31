import { describe, it, expect } from 'vitest'
import { BOARD_H, BOARD_W, EmptyLessonError, MAX_ELEMENTS, MAX_NARRATION, MAX_STEPS, arrowHead, cleanLesson, readingMs, revealedAt, wrapText } from '@/lib/lesson/script'

const el = (id: string, over: Record<string, unknown> = {}) => ({ id, kind: 'box', x: 10, y: 10, w: 30, h: 16, x2: 0, y2: 0, text: id, color: 'accent', ...over })
const steps = (...s: [string, string[], string[]?][]) => s.map(([narration, show, focus]) => ({ narration, show, focus: focus ?? [] }))

describe('cleaning a lesson the AI wrote', () => {
  it('keeps a good lesson as it is', () => {
    const l = cleanLesson({ title: 'The Krebs cycle', elements: [el('a'), el('b', { x: 60 })], steps: steps(['First.', ['a']], ['Then.', ['b'], ['a']]) })
    expect(l.title).toBe('The Krebs cycle')
    expect(l.elements.map(e => e.id)).toEqual(['a', 'b'])
    expect(l.steps.map(s => s.show)).toEqual([['a'], ['b']])
    expect(l.steps[1].focus).toEqual(['a'])
  })
  it('pulls a shape that runs off the board back on, and keeps a text readable', () => {
    const l = cleanLesson({ elements: [el('a', { x: 500, y: -4, w: 60, h: 400 }), el('t', { kind: 'text', x: 80, y: 10, h: 0, text: 'x' })], steps: steps(['One.', ['a']], ['Two.', ['t']]) })
    const a = l.elements[0]
    expect(a.x + a.w).toBeLessThanOrEqual(BOARD_W)
    expect(a.y).toBeGreaterThanOrEqual(0)
    expect(a.y + a.h).toBeLessThanOrEqual(BOARD_H)
    expect(l.elements[1].h).toBeGreaterThanOrEqual(3)
  })
  it('drops a repeated id, an id no step can find, and anything past the limits', () => {
    const l = cleanLesson({ elements: [el('a'), el('a', { text: 'again' }), ...Array.from({ length: 60 }, (_, i) => el(`e${i}`))], steps: steps(['One.', ['a', 'ghost']], ['Two.', []]) })
    expect(l.elements).toHaveLength(MAX_ELEMENTS)
    expect(l.elements.find(e => e.id === 'a')!.text).toBe('a')
    expect(l.steps[0].show).toEqual(['a'])
  })
  it('shows an element two steps both name only once, and any no step names in the last step', () => {
    const l = cleanLesson({ elements: [el('a'), el('b'), el('c')], steps: steps(['One.', ['a']], ['Two.', ['a', 'b']]) })
    expect(l.steps[0].show).toEqual(['a'])
    expect(l.steps[1].show).toEqual(['b', 'c'])
  })
  it('keeps the narration short and plain, and at most eight steps', () => {
    const l = cleanLesson({ elements: [el('a')], steps: Array.from({ length: 12 }, () => ({ narration: `  ${'word '.repeat(200)}\n`, show: ['a'], focus: [] })) })
    expect(l.steps).toHaveLength(MAX_STEPS)
    expect(l.steps[0].narration.length).toBeLessThanOrEqual(MAX_NARRATION)
    expect(l.steps[0].narration).not.toMatch(/^\s|\s$|\n/)
  })
  it('turns an unknown kind or colour into a box in the accent', () => {
    const l = cleanLesson({ elements: [el('a', { kind: 'star', color: 'pink' })], steps: steps(['One.', ['a']], ['Two.', []]) })
    expect(l.elements[0]).toMatchObject({ kind: 'box', color: 'accent' })
  })
  it('says there is no lesson when it has too few steps or nothing to draw', () => {
    expect(() => cleanLesson({ elements: [el('a')], steps: steps(['Only one.', ['a']]) })).toThrow(EmptyLessonError)
    expect(() => cleanLesson({ elements: [], steps: steps(['One.', []], ['Two.', []]) })).toThrow(EmptyLessonError)
    expect(() => cleanLesson({})).toThrow(EmptyLessonError)
    expect(() => cleanLesson({ elements: [el('a')], steps: steps(['', ['a']], ['  ', []]) })).toThrow(EmptyLessonError)
  })
})

describe('the board helpers', () => {
  it('says which step first shows each element', () => {
    const l = cleanLesson({ elements: [el('a'), el('b')], steps: steps(['One.', ['a']], ['Two.', ['b']]) })
    expect([...revealedAt(l)]).toEqual([['a', 0], ['b', 1]])
  })
  it('breaks words into lines that fit, cutting a word that is too long', () => {
    expect(wrapText('Light reactions in the thylakoid', 12)).toEqual(['Light', 'reactions in', 'the', 'thylakoid'])
    expect(wrapText('Mitochondrion', 6)).toEqual(['Mitoch', 'ondrio', 'n'])
    expect(wrapText('', 10)).toEqual([])
  })
  it('draws an arrow\'s head at its end, pointing along the line', () => {
    const [tip, a, b] = arrowHead(0, 0, 10, 0, 2).split(' ').map(p => p.split(',').map(Number))
    expect(tip).toEqual([10, 0])
    expect(a[0]).toBeLessThan(10); expect(b[0]).toBeLessThan(10) // the barbs sit behind the tip
    expect(a[1]).toBeCloseTo(-b[1]) // on either side of the line
  })
  it('gives a step with no voice time to be read', () => {
    expect(readingMs('Short.')).toBe(2500)
    expect(readingMs('x'.repeat(300))).toBe(18000)
  })
})
