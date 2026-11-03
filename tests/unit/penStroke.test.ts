import { describe, expect, it } from 'vitest'
import { boxStroke, headStroke, lineStroke, ovalStroke } from '@/lib/lesson/penStroke'

const numbers = (d: string) => (d.match(/-?\d+\.\d+/g) ?? []).map(Number)

describe('the pen strokes of a lesson', () => {
  it('draw the same element the same way every time, and different elements differently', () => {
    expect(boxStroke('a', 10, 10, 30, 16)).toBe(boxStroke('a', 10, 10, 30, 16))
    expect(boxStroke('a', 10, 10, 30, 16)).not.toBe(boxStroke('b', 10, 10, 30, 16))
    expect(ovalStroke('a', 50, 40, 20, 10)).toBe(ovalStroke('a', 50, 40, 20, 10))
  })
  it('stay close to the shape: a little unsteady, never far off it', () => {
    const xs = numbers(boxStroke('a', 10, 20, 30, 16)).filter((_, i) => i % 2 === 0)
    expect(Math.min(...xs)).toBeGreaterThan(9)
    expect(Math.max(...xs)).toBeLessThan(41)
    const ys = numbers(ovalStroke('a', 50, 40, 20, 10)).filter((_, i) => i % 2 === 1)
    expect(Math.min(...ys)).toBeGreaterThan(29)
    expect(Math.max(...ys)).toBeLessThan(51)
  })
  it('end a line exactly where it was asked to, so an arrow meets what it points at', () => {
    expect(lineStroke('a', 40, 18, 60, 18).endsWith('L60.00 18.00')).toBe(true)
  })
  it('draw an arrow\'s head as two strokes back from its tip', () => {
    expect(headStroke(40, 18, 60, 18)).toContain('L60.00 18.00 L')
    const [x1, , , , x2] = numbers(headStroke(40, 18, 60, 18))
    expect(x1).toBeLessThan(60)
    expect(x2).toBeLessThan(60)
  })
  it('cope with an arrow of no length', () => {
    expect(lineStroke('a', 5, 5, 5, 5)).toContain('L5.00 5.00')
  })
})
