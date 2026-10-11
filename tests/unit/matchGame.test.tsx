// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { MatchGame } from '@/components/games/MatchGame'

const cards = [1, 2, 3, 4].map(i => ({ id: `c${i}`, front: `Term ${i}`, back: `Meaning ${i}` }))
const fronts = () => screen.getByRole('group', { name: 'Terms' })
const backs = () => screen.getByRole('group', { name: 'Meanings' })
const pick = (i: number, j: number) => {
  fireEvent.click(within(fronts()).getByRole('button', { name: new RegExp(`Term ${i}`) }))
  fireEvent.click(within(backs()).getByRole('button', { name: new RegExp(`Meaning ${j}`) }))
}
afterEach(cleanup)

describe('MatchGame', () => {
  it('shows every term and meaning', () => {
    render(<MatchGame cards={cards} onDone={() => {}} />)
    expect(within(fronts()).getAllByRole('button')).toHaveLength(4)
    expect(within(backs()).getAllByRole('button')).toHaveLength(4)
  })
  it('locks a right pair and says so in words', () => {
    render(<MatchGame cards={cards} onDone={() => {}} />)
    pick(1, 1)
    const t = within(fronts()).getByRole('button', { name: /Term 1/ }) as HTMLButtonElement
    expect(t.disabled).toBe(true)
    expect(t.textContent).toContain('Matched')
  })
  it('announces a right pair by its term and moves focus to the next free term', () => {
    render(<MatchGame cards={cards} onDone={() => {}} />)
    pick(1, 1)
    expect(screen.getByRole('status').textContent).toBe('Matched: Term 1')
    const active = document.activeElement as HTMLButtonElement
    expect(within(fronts()).getAllByRole('button')).toContain(active)
    expect(active.disabled).toBe(false)
  })
  it('says Not a match for a wrong pair and lets the student try again', () => {
    render(<MatchGame cards={cards} onDone={() => {}} />)
    pick(1, 2)
    expect(screen.getByText('Not a match')).toBeTruthy()
    expect((within(fronts()).getByRole('button', { name: /Term 1/ }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('finishes with a full score when no pair was missed', () => {
    const onDone = vi.fn()
    render(<MatchGame cards={cards} onDone={onDone} />)
    for (const i of [1, 2, 3, 4]) pick(i, i)
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onDone).toHaveBeenCalledWith({ score: 4, total: 4 })
  })
  it('does not count a pair whose term was missed first', () => {
    const onDone = vi.fn()
    render(<MatchGame cards={cards} onDone={onDone} />)
    pick(1, 2); pick(1, 1); pick(2, 2); pick(3, 3); pick(4, 4)
    expect(onDone).toHaveBeenCalledWith({ score: 3, total: 4 })
  })
  it('pairs the term tapped last when two terms are tapped in a row', () => {
    render(<MatchGame cards={cards} onDone={() => {}} />)
    fireEvent.click(within(fronts()).getByRole('button', { name: /Term 1/ }))
    fireEvent.click(within(fronts()).getByRole('button', { name: /Term 2/ }))
    fireEvent.click(within(backs()).getByRole('button', { name: /Meaning 2/ }))
    expect((within(fronts()).getByRole('button', { name: /Term 2/ }) as HTMLButtonElement).disabled).toBe(true) // the second tap changed the choice
  })
})
