import { describe, it, expect } from 'vitest'
import { courseNamed } from '@/lib/ai/courseNamed'

const courses = [{ id: 'm', name: 'MATH 121' }, { id: 'b', name: 'Biology' }, { id: 'bi', name: 'Biology II' }, { id: 'x', name: 'IT' }, { id: 'c', name: 'Café Studies' }]

describe('the course a message names', () => {
  it('finds it by its whole name, in any case and punctuation', () => {
    expect(courseNamed('you should be teaching math 121', courses)?.id).toBe('m')
    expect(courseNamed('Teach me MATH-121, please!', courses)?.id).toBe('m')
    expect(courseNamed('cafe studies notes', courses)?.id).toBe('c')
  })
  it('takes the longest name when one is inside another', () => {
    expect(courseNamed('start biology II', courses)?.id).toBe('bi')
    expect(courseNamed('start biology', courses)?.id).toBe('b')
  })
  it('needs the whole name as whole words, and ignores very short names', () => {
    expect(courseNamed('mathematics 1210', courses)).toBeNull()
    expect(courseNamed('what is IT about', courses)).toBeNull()
    expect(courseNamed('', courses)).toBeNull()
  })
})
