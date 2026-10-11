// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { SpeedGame } from '@/components/games/SpeedGame'
import type { Question } from '@/lib/games/build'

const q = (n: number): Question => ({ card: { id: `c${n}`, front: `Front ${n}`, back: `Right ${n}` }, answer: `Right ${n}`, options: [`Wrong a${n}`, `Right ${n}`, `Wrong b${n}`, `Wrong c${n}`] })
afterEach(cleanup)

describe('SpeedGame', () => {
  it('shows the front, four options and where the student is', () => {
    render(<SpeedGame questions={[q(1), q(2)]} onDone={() => {}} />)
    expect(screen.getByText('Front 1')).toBeTruthy()
    expect(screen.getByText('Question 1 of 2')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /Right 1|Wrong/ })).toHaveLength(4)
  })
  it('says Correct for the right option and locks the choices', () => {
    render(<SpeedGame questions={[q(1), q(2)]} onDone={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Right 1' }))
    expect(screen.getByText('Correct.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Wrong a1' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('says what the answer was after a wrong pick', () => {
    render(<SpeedGame questions={[q(1), q(2)]} onDone={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Wrong a1' }))
    expect(screen.getByText('Not quite. The answer is:')).toBeTruthy()
    expect(screen.getAllByText('Right 1').length).toBeGreaterThan(0)
  })
  it('keeps one status area and moves focus to Next after an answer, and to the new question after Next', () => {
    render(<SpeedGame questions={[q(1), q(2)]} onDone={() => {}} />)
    const status = screen.getByRole('status')
    fireEvent.click(screen.getByRole('button', { name: 'Right 1' }))
    expect(screen.getByRole('status')).toBe(status)
    expect(within(status).getByText('Correct.')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(status.textContent).toBe('')
    expect(document.activeElement?.textContent).toContain('Front 2')
  })
  it('only moves on after an answer, and finishes with the score', () => {
    const onDone = vi.fn()
    render(<SpeedGame questions={[q(1), q(2)]} onDone={onDone} />)
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Right 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Question 2 of 2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Wrong a2' }))
    fireEvent.click(screen.getByRole('button', { name: 'See results' }))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledWith({ score: 1, total: 2 })
  })
})
