// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { TaskRail } from '@/components/planner/TaskRail'

afterEach(cleanup)
const setup = (over: Partial<React.ComponentProps<typeof TaskRail>> = {}) => {
  const h = { onList: vi.fn(), onType: vi.fn() }
  render(<TaskRail list="all" counts={{ all: 9, today: 3, upcoming: 5, someday: 1, done: 4 }} type="all" typeCounts={{ all: 9, other: 4, assignment: 3, exam: 1, reading: 1 }} {...h} {...over} />)
  return h
}

describe('TaskRail', () => {
  it('lists the task lists with their counts, marking the one shown', () => {
    setup({ list: 'today' })
    const nav = screen.getByRole('navigation', { name: 'Task lists' })
    expect(within(nav).getAllByRole('button').map(b => b.textContent)).toEqual(['All tasks 9', 'Today 3', 'Upcoming 5', 'Someday 1', 'Done 4'])
    expect(within(nav).getByRole('button', { name: /^Today/ }).getAttribute('aria-current')).toBe('true')
    expect(within(nav).getByRole('button', { name: /^All tasks/ }).getAttribute('aria-current')).toBeNull()
  })
  it('chooses a list', () => {
    const h = setup()
    fireEvent.click(screen.getByRole('button', { name: /^Done/ }))
    expect(h.onList).toHaveBeenCalledWith('done')
  })
  it('filters by type with counts, and says which is on', () => {
    const h = setup({ type: 'exam' })
    const types = screen.getByRole('group', { name: 'Task type' })
    expect(within(types).getByRole('button', { name: /^Exams 1/ }).getAttribute('aria-pressed')).toBe('true')
    expect(within(types).getByRole('button', { name: /^All 9/ }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(within(types).getByRole('button', { name: /^Readings/ }))
    expect(h.onType).toHaveBeenCalledWith('reading')
  })
})
