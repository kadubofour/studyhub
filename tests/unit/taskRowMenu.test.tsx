// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TaskRow } from '@/components/planner/TaskRow'
import type { Task } from '@/lib/types'

afterEach(cleanup)
const task = { id: 't1', title: 'Calc problem set', type: 'assignment', priority: 'normal', due_at: null, done_at: null, course_id: null, created_at: '' } as Task
const row = (over: Partial<Parameters<typeof TaskRow>[0]> = {}) => {
  const fns = { onToggle: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() }
  render(<TaskRow task={task} tz="UTC" now={new Date()} {...fns} {...over} />)
  return fns
}

describe('right click on a task', () => {
  it('offers done, edit and delete, and does them', () => {
    const fns = row()
    fireEvent.contextMenu(screen.getByText('Calc problem set'))
    expect(screen.getByRole('menu', { name: 'Calc problem set options' })).toBeTruthy()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark done' }))
    expect(fns.onToggle).toHaveBeenCalledTimes(1)
    fireEvent.contextMenu(screen.getByText('Calc problem set'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))
    expect(fns.onEdit).toHaveBeenCalledTimes(1)
    fireEvent.contextMenu(screen.getByText('Calc problem set'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(fns.onDelete).toHaveBeenCalledTimes(1)
  })
  it('says Mark not done for a task that is done, and leaves out what the row cannot do', () => {
    row({ done: true, onEdit: undefined, onDelete: undefined })
    fireEvent.contextMenu(screen.getByText('Calc problem set'))
    expect(screen.getByRole('menuitem', { name: 'Mark not done' })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull()
  })
  it('does nothing while the task is still saving', () => {
    const fns = row({ task: { ...task, id: 'temp-1' } })
    fireEvent.contextMenu(screen.getByText('Calc problem set'))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark done' }))
    expect(fns.onToggle).not.toHaveBeenCalled()
  })
})
