// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { LessonPlayer } from '@/components/tutor/LessonPlayer'
import { cleanLesson } from '@/lib/lesson/script'

const el = (id: string, over: Record<string, unknown> = {}) => ({ id, kind: 'box', x: 10, y: 10, w: 30, h: 16, x2: 0, y2: 0, text: id, color: 'accent', ...over })
const script = cleanLesson({
  title: 'The Krebs cycle',
  elements: [el('a', { text: 'Acetyl-CoA' }), el('b', { x: 60, text: 'Citrate' }), el('arrow', { kind: 'arrow', x: 40, y: 18, x2: 60, y2: 18, text: 'joins' })],
  steps: [
    { narration: 'First, acetyl-CoA arrives.', show: ['a'], focus: ['a'] },
    { narration: 'It joins oxaloacetate to make citrate.', show: ['b', 'arrow'], focus: ['b'] },
    { narration: 'And the cycle turns.', show: [], focus: [] },
  ],
})
const played: string[] = []
beforeEach(() => {
  played.length = 0
  vi.useFakeTimers()
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: function (this: HTMLAudioElement) { played.push(this.src); return Promise.resolve() } })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: () => {} })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

const shown = () => [...document.querySelectorAll('[data-element]')].map(e => e.getAttribute('data-element'))
const voices = ['http://v/0.mp3', 'http://v/1.mp3', 'http://v/2.mp3']

describe('the lesson player', () => {
  it('starts at the first step, with only what it shows, and says it in words', () => {
    render(<LessonPlayer script={script} voices={voices} />)
    expect(screen.getByRole('region', { name: 'Lesson: The Krebs cycle' })).toBeTruthy()
    expect(screen.getByText('First, acetyl-CoA arrives.')).toBeTruthy()
    expect(shown()).toEqual(['a'])
    expect(document.querySelector('[data-element="a"]')!.getAttribute('class')).toContain('lesson-focus') // the voice points at it
  })
  it('builds the drawing up as steps go on, and takes it back down going back', () => {
    render(<LessonPlayer script={script} voices={voices} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(shown()).toEqual(['a', 'b', 'arrow'])
    expect(document.querySelector('[data-element="b"]')!.getAttribute('class')).toContain('lesson-in') // new this step
    expect(document.querySelector('[data-element="a"]')!.getAttribute('class')).not.toContain('lesson-in')
    expect(screen.getByText('It joins oxaloacetate to make citrate.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' }))
    expect(shown()).toEqual(['a'])
    expect((screen.getByRole('button', { name: 'Previous step' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('goes to any step from the dots', () => {
    render(<LessonPlayer script={script} voices={voices} />)
    fireEvent.click(screen.getByRole('button', { name: 'Step 3' }))
    expect(screen.getByText('And the cycle turns.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Step 3' }).getAttribute('aria-current')).toBe('step')
  })
  it('plays each step\'s voice, and moves on by itself when one ends, until the end, then offers a replay', () => {
    render(<LessonPlayer script={script} voices={voices} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(played).toEqual(['http://v/0.mp3'])
    fireEvent.ended(document.querySelector('audio')!)
    expect(screen.getByText('It joins oxaloacetate to make citrate.')).toBeTruthy()
    expect(played.at(-1)).toBe('http://v/1.mp3')
    fireEvent.ended(document.querySelector('audio')!)
    expect(played.at(-1)).toBe('http://v/2.mp3')
    fireEvent.ended(document.querySelector('audio')!) // the last step is spoken: it stops
    expect(screen.getByRole('button', { name: 'Replay' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Replay' }))
    expect(screen.getByText('First, acetyl-CoA arrives.')).toBeTruthy()
    expect(played.at(-1)).toBe('http://v/0.mp3')
  })
  it('pauses and resumes', () => {
    render(<LessonPlayer script={script} voices={voices} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(screen.getByRole('button', { name: 'Resume' })).toBeTruthy()
  })
  it('a step with no voice stays for as long as it takes to read, then goes on', () => {
    render(<LessonPlayer script={script} voices={[null, null, null]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(played).toEqual([])
    act(() => { vi.advanceTimersByTime(2400) })
    expect(screen.getByText('First, acetyl-CoA arrives.')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.getByText('It joins oxaloacetate to make citrate.')).toBeTruthy()
  })
  it('can be deleted when it is given a way to', () => {
    const onDelete = vi.fn()
    render(<LessonPlayer script={script} voices={voices} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete lesson' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
