// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { HomeActions } from '@/components/home/HomeActions'
import { OPEN_QUIZ } from '@/lib/quiz/events'

afterEach(cleanup)
const open = (p: Partial<React.ComponentProps<typeof HomeActions>> = {}) => render(<HomeActions due={12} nextClass="Biology, 10:00" {...p} />)

describe('Home quick actions', () => {
  it('are one strip of four, each saying what it is about and what it leads to', () => {
    open()
    const group = screen.getByRole('group', { name: 'Quick actions' })
    const cells = [...group.querySelectorAll('a, button')]
    expect(cells.map(c => c.querySelector('[data-label]')?.textContent)).toEqual(['Cards to review', 'Next class', 'Quiz yourself', 'Ask the tutor'])
    expect(cells.map(c => c.querySelector('[data-value]')?.textContent)).toEqual(['12 due', 'Biology, 10:00', 'Pick a note', 'Start a chat'])
  })
  it('review leads to the review, and says so when nothing is due', () => {
    open()
    expect(screen.getByRole('link', { name: /Cards to review/ }).getAttribute('href')).toBe('/review')
    cleanup()
    open({ due: 0 })
    const link = screen.getByRole('link', { name: /Cards to review/ })
    expect(link.querySelector('[data-value]')!.textContent).toBe('All caught up')
    expect(link.getAttribute('href')).toBe('/flashcards')
  })
  it('the next class leads to the Planner, and shows a dash when there is none', () => {
    open({ nextClass: null })
    const link = screen.getByRole('link', { name: /Next class/ })
    expect(link.getAttribute('href')).toBe('/planner')
    expect(link.querySelector('[data-value]')!.textContent).toBe('—')
  })
  it('opens the Quiz dialog by asking the app to, and goes to the Tutor with a link', () => {
    const quiz = vi.fn()
    window.addEventListener(OPEN_QUIZ, quiz)
    open()
    fireEvent.click(screen.getByRole('button', { name: /Quiz yourself/ }))
    expect(quiz).toHaveBeenCalledTimes(1)
    window.removeEventListener(OPEN_QUIZ, quiz)
    expect(screen.getByRole('link', { name: /Ask the tutor/ }).getAttribute('href')).toBe('/tutor')
  })
  it('are plain cells split by hairlines: no tinted tiles and no icons in coloured circles', () => {
    open()
    const group = screen.getByRole('group', { name: 'Quick actions' })
    expect(group.className).toContain('gap-px')
    expect(group.className).toContain('bg-line')
    for (const c of group.querySelectorAll('a, button')) {
      expect(c.className).not.toContain('bg-accent-soft')
      expect(c.querySelector('.bg-accent-solid')).toBeNull()
    }
  })
  it('the counts use figures that line up', () => {
    open()
    expect(screen.getByText('12 due').className).toContain('tabular-nums')
  })
})
