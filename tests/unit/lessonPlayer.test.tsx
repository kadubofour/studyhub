// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { LessonPlayer } from '@/components/tutor/LessonPlayer'
import { cleanLesson } from '@/lib/lesson/script'
import { lessonSpeed, parseSpeed } from '@/lib/lesson/speed'

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
  lessonSpeed.set(1)
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
  it('highlights what the voice points at, and only while it does', () => {
    render(<LessonPlayer script={script} voices={voices} />)
    const swiped = () => [...document.querySelectorAll('.lesson-highlight')].map(e => e.closest('[data-element]')!.getAttribute('data-element'))
    expect(swiped()).toEqual(['a'])
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(swiped()).toEqual(['b'])
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    expect(swiped()).toEqual([])
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

describe('the speed of a lesson', () => {
  const slider = () => screen.getByRole('slider', { name: /Speed/ }) as HTMLInputElement
  const set = (v: number) => fireEvent.change(slider(), { target: { value: String(v) } })
  it('goes from half speed to double, starting at normal, and says what it is', () => {
    render(<LessonPlayer script={script} voices={voices} />)
    expect([slider().min, slider().max, slider().value]).toEqual(['0.5', '2', '1'])
    set(1.5)
    expect(slider().getAttribute('aria-valuetext')).toBe('1.5 times')
    expect(screen.getByText('1.5×')).toBeTruthy()
  })
  it('changes the voice at once without starting it again, and keeps the speed on the next step', () => {
    render(<LessonPlayer script={script} voices={voices} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    const a = document.querySelector('audio')!
    expect(a.playbackRate).toBe(1)
    set(0.5)
    expect(a.playbackRate).toBe(0.5)
    expect(played).toEqual(['http://v/0.mp3'])
    fireEvent.ended(a)
    expect(played.at(-1)).toBe('http://v/1.mp3')
    expect(a.playbackRate).toBe(0.5)
  })
  it('sets the speed of the drawing too', () => {
    render(<LessonPlayer script={script} voices={voices} />)
    set(2)
    expect(screen.getByRole('region', { name: /Lesson/ }).style.getPropertyValue('--lesson-speed')).toBe('2')
  })
  it('a step with no voice is shown for less time when faster', () => {
    render(<LessonPlayer script={script} voices={[null, null, null]} />)
    set(2)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    act(() => { vi.advanceTimersByTime(1200) })
    expect(screen.getByText('First, acetyl-CoA arrives.')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(100) })
    expect(screen.getByText('It joins oxaloacetate to make citrate.')).toBeTruthy()
  })
  it('is remembered, and a nonsense stored value falls back to normal', () => {
    render(<LessonPlayer script={script} voices={voices} />)
    set(1.25)
    cleanup()
    render(<LessonPlayer script={script} voices={voices} />)
    expect(slider().value).toBe('1.25')
    for (const bad of [0, 3, 1.1, '2', null]) expect(parseSpeed(bad)).toBe(1)
    expect(parseSpeed(0.75)).toBe(0.75)
  })
})

describe('the lesson player on the whole screen', () => {
  const open = () => render(<LessonPlayer script={script} voices={voices} />)
  it('can be taken full screen, and asks the browser to do it where it can', () => {
    const requestFullscreen = vi.fn(() => Promise.resolve())
    HTMLElement.prototype.requestFullscreen = requestFullscreen
    open()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    const full = screen.getByRole('dialog', { name: 'Lesson: The Krebs cycle' })
    expect(full.className).toContain('fixed inset-0')
    expect(screen.getByRole('button', { name: 'Exit full screen' }).getAttribute('aria-pressed')).toBe('true')
    delete (HTMLElement.prototype as { requestFullscreen?: unknown }).requestFullscreen
  })
  it('fills the window all the same when the browser has no full screen of its own', () => {
    delete (HTMLElement.prototype as { requestFullscreen?: unknown }).requestFullscreen
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
    expect(screen.getByRole('dialog').className).toContain('fixed inset-0')
  })
  it('keeps playing through the change: the same voice element, the same step, the same controls', async () => {
    const { container } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    await act(async () => {})
    const audio = container.querySelector('audio')
    fireEvent.click(screen.getByRole('button', { name: 'Next step' }))
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
    expect(container.querySelector('audio')).toBe(audio) // not made again, so the voice is not cut off
    expect(screen.getByText('It joins oxaloacetate to make citrate.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Previous step' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Steps' })).toBeTruthy()
  })
  it('leaves on Esc, and with the button', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Exit full screen' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('does not offer to delete the lesson from the full screen, where a slip would lose it', () => {
    render(<LessonPlayer script={script} voices={voices} onDelete={() => {}} />)
    expect(screen.getByRole('button', { name: 'Delete lesson' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }))
    expect(screen.queryByRole('button', { name: 'Delete lesson' })).toBeNull()
  })
})
