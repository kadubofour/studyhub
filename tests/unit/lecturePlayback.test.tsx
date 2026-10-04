// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { createRef } from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { LecturePlayer, type PlayerHandle } from '@/components/lectures/LecturePlayer'
import { TranscriptView } from '@/components/lectures/TranscriptView'

beforeAll(() => {
  // jsdom doesn't play media
  HTMLMediaElement.prototype.play = vi.fn(async () => {})
  HTMLMediaElement.prototype.pause = vi.fn()
})
afterEach(() => cleanup())

const parts = [
  { path: 'a', start: 0, duration: 1200, bytes: 1, transcribed: false },
  { path: 'b', start: 1200, duration: 1200, bytes: 1, transcribed: false },
  { path: 'c', start: 2400, duration: 300, bytes: 1, transcribed: false },
]
const urls = ['https://x/a', 'https://x/b', 'https://x/c']
const audio = () => document.querySelector('audio[data-current]') as HTMLAudioElement

describe('LecturePlayer', () => {
  it('seeking to a time in part 3 plays part 3 from the right place', async () => {
    const player = createRef<PlayerHandle>()
    render(<LecturePlayer ref={player} urls={urls} parts={parts} duration={2700} onTime={vi.fn()} />)
    expect(audio().src).toBe(urls[0])
    await act(async () => { player.current!.seek(2500) })
    await act(async () => { fireEvent(audio(), new Event('loadedmetadata')) })
    expect(audio().src).toBe(urls[2])
    expect(audio().currentTime).toBe(100)
    expect(screen.getByText('41:40 / 45:00')).toBeTruthy()
  })
  it('carries on into the next part when one ends', async () => {
    const onTime = vi.fn()
    render(<LecturePlayer urls={urls} parts={parts} duration={2700} onTime={onTime} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Play' })) })
    await act(async () => { fireEvent(audio(), new Event('ended')) })
    expect(audio().src).toBe(urls[1])
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled()
  })
  it('reports the lecture time as a part plays', async () => {
    const onTime = vi.fn()
    const player = createRef<PlayerHandle>()
    render(<LecturePlayer ref={player} urls={urls} parts={parts} duration={2700} onTime={onTime} />)
    await act(async () => { player.current!.seek(1300) })
    await act(async () => { fireEvent(audio(), new Event('loadedmetadata')) })
    Object.defineProperty(audio(), 'currentTime', { value: 150, configurable: true })
    await act(async () => { fireEvent(audio(), new Event('timeupdate')) })
    expect(onTime).toHaveBeenLastCalledWith(1350)
  })
})

describe('TranscriptView', () => {
  const lines = [{ start: 0, end: 4, text: 'Welcome to the lecture.' }, { start: 75, end: 80, text: 'The Krebs cycle.' }, { start: 90, end: 95, text: 'It happens in the matrix.' }]
  it('tapping a line seeks to it, and the line being spoken is marked', () => {
    const onSeek = vi.fn()
    render(<TranscriptView lines={lines} currentTime={80} onSeek={onSeek} />)
    fireEvent.click(screen.getByRole('button', { name: /1:15 The Krebs cycle/ }))
    expect(onSeek).toHaveBeenCalledWith(75)
    expect(screen.getByRole('button', { name: /1:15 The Krebs cycle/ }).getAttribute('aria-current')).toBe('true')
  })
  it('search shows only matching lines, with a count', () => {
    render(<TranscriptView lines={lines} currentTime={0} onSeek={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Search transcript'), { target: { value: 'krebs' } })
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByText('1 match')).toBeTruthy()
  })
})
