// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { TaskCard } from '@/components/planner/TaskCard'
import type { Task } from '@/lib/types'

afterEach(cleanup)
const course = { id: 'bio', name: 'Biology', color: '#1D9E75' }
const task = (over: Partial<Task> = {}): Task =>
  ({ id: '6b1c', course_id: 'bio', title: 'Essay', type: 'assignment', due_at: '2026-10-16T23:59:59Z', priority: 'normal', done_at: null, created_at: '', ...over })
const NOW = new Date('2026-10-14T10:00:00Z')
const setup = (t: Task, extra: Partial<React.ComponentProps<typeof TaskCard>> = {}) => {
  const h = { onToggle: vi.fn(), onEdit: vi.fn(), onMove: vi.fn(), onDelete: vi.fn() }
  render(<TaskCard task={t} course={course} tz="Africa/Accra" now={NOW} {...h} {...extra} />)
  return h
}

describe('TaskCard', () => {
  it('shows the title, course, type and when it is due', () => {
    setup(task())
    expect(screen.getByRole('button', { name: 'Edit Essay' })).toBeTruthy()
    expect(screen.getByText('Biology')).toBeTruthy()
    expect(screen.getByText('Assignment')).toBeTruthy()
    expect(screen.getByText('Fri')).toBeTruthy()
  })
  it('ticks, and opens for editing from the title', () => {
    const h = setup(task())
    fireEvent.click(screen.getByLabelText('Mark Essay done'))
    fireEvent.click(screen.getByRole('button', { name: 'Edit Essay' }))
    expect(h.onToggle).toHaveBeenCalledTimes(1)
    expect(h.onEdit).toHaveBeenCalledTimes(1)
  })
  it('flags high priority and shows an overdue date in red words', () => {
    setup(task({ priority: 'high', due_at: '2026-10-12T23:59:59Z' }))
    expect(screen.getByText('High priority')).toBeTruthy()
    expect(screen.getByText('Overdue')).toBeTruthy()
  })
  it('moves with a small menu: Today, Tomorrow, Next week, No date', () => {
    const h = setup(task())
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Move Essay' }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent)).toEqual(['Today', 'Tomorrow', 'Next week', 'No date'])
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Tomorrow' }))
    expect(h.onMove).toHaveBeenCalledWith('tomorrow')
    expect(screen.queryByRole('menu')).toBeNull()
  })
  it('deletes from its own button', () => {
    const h = setup(task())
    fireEvent.click(screen.getByRole('button', { name: 'Delete Essay' }))
    expect(h.onDelete).toHaveBeenCalledTimes(1)
  })
  it('Escape closes the menu', () => {
    setup(task())
    fireEvent.click(screen.getByRole('button', { name: 'Move Essay' }))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })
  it('cannot be ticked, edited or moved while it is still saving', () => {
    setup(task({ id: 'temp-1' }))
    expect((screen.getByLabelText('Mark Essay done') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Edit Essay' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Move Essay' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Delete Essay' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('shows no date line for a task without one', () => {
    setup(task({ due_at: null }))
    expect(screen.queryByText('Fri')).toBeNull()
  })
})

describe('Remind me', () => {
  it('asks for a reminder about the task, on its due day, that opens the Planner', async () => {
    const { OPEN_REMINDER } = await import('@/lib/reminders/events')
    const heard = vi.fn()
    window.addEventListener(OPEN_REMINDER, heard as EventListener)
    setup(task({ title: 'Essay draft', due_at: '2026-10-16T23:59:00Z' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remind me about Essay draft' }))
    expect((heard.mock.calls[0][0] as CustomEvent).detail).toEqual({ title: 'Essay draft', day: '2026-10-16', href: '/planner', link_label: 'Essay draft' })
    window.removeEventListener(OPEN_REMINDER, heard as EventListener)
  })
})
