// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SessionRow } from '@/components/plan/SessionRow'
import type { SessionView } from '@/lib/plan/load'

afterEach(cleanup)
const s = (over: Partial<SessionView> = {}): SessionView => ({ id: 's1', topic_id: 't1', kind: 'learn', minutes: 25, done_at: null, topicName: 'Krebs cycle', noteId: 'n1', ...over })
const course = { id: 'c1', name: 'Biology', color: '#1D9E75' }
const row = (over: Partial<SessionView> = {}, props: Partial<React.ComponentProps<typeof SessionRow>> = {}) =>
  render(<SessionRow s={s(over)} course={course} done={false} onToggle={() => {}} {...props} />)

describe('SessionRow', () => {
  it('shows the kind, the topic, the course and the minutes, with an Open link to the note', () => {
    row()
    expect(screen.getByText('Learn: Krebs cycle')).toBeTruthy()
    expect(screen.getByText('25 min')).toBeTruthy()
    expect(screen.getByText('Biology')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/notes/n1')
  })
  it('opens Topics on Progress when the topic has no note', () => {
    row({ noteId: null })
    expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/progress')
  })
  it('ticks and unticks', () => {
    const onToggle = vi.fn()
    row({}, { onToggle })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Learn: Krebs cycle done' }))
    expect(onToggle).toHaveBeenCalled()
    cleanup()
    row({ done_at: 'x' }, { done: true })
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('Learn: Krebs cycle').className).toMatch(/line-through/)
  })
  it('a Warm-up starts the quiz instead of Open, and shows when it is working', () => {
    const onWarmup = vi.fn()
    row({ kind: 'warmup', minutes: 10 }, { onWarmup })
    expect(screen.queryByRole('link', { name: 'Open' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Start warm-up' }))
    expect(onWarmup).toHaveBeenCalled()
    cleanup()
    row({ kind: 'warmup' }, { onWarmup, warmingUp: true })
    expect(screen.getByRole('button', { name: 'Making quiz…' })).toBeTruthy()
  })
  describe('a topic with an uploaded file and no note', () => {
    const file = { noteId: null, materialId: 'f1' }
    it('opens the file, and a Warm-up can start from it', () => {
      const onWarmup = vi.fn()
      row({ kind: 'warmup', ...file }, { onWarmup })
      fireEvent.click(screen.getByRole('button', { name: 'Start warm-up' }))
      expect(onWarmup).toHaveBeenCalled()
      cleanup()
      row({ ...file })
      expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/files/f1')
    })
  })
  it('a Revise offers a quiz, and a Learn offers flashcards, when there is something to make them from', () => {
    const onWarmup = vi.fn(), onCards = vi.fn()
    row({ kind: 'revise' }, { onWarmup })
    fireEvent.click(screen.getByRole('button', { name: 'Quiz me' }))
    expect(onWarmup).toHaveBeenCalled()
    cleanup()
    row({ kind: 'learn' }, { onCards })
    fireEvent.click(screen.getByRole('button', { name: 'Flashcards' }))
    expect(onCards).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Open' })).toBeTruthy() // Open stays beside it
  })
  it('offers neither when the topic has no note or file', () => {
    row({ kind: 'revise', noteId: null }, { onWarmup: () => {} })
    expect(screen.queryByRole('button', { name: 'Quiz me' })).toBeNull()
    cleanup()
    row({ kind: 'learn', noteId: null }, { onCards: () => {} })
    expect(screen.queryByRole('button', { name: 'Flashcards' })).toBeNull()
  })
})
