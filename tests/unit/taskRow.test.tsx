// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { TaskRow } from '@/components/planner/TaskRow'
import type { Task } from '@/lib/types'

const task = (id: string): Task => ({ id, course_id: null, title: 'Essay', type: 'other', due_at: null, priority: 'normal', done_at: null, created_at: '' })
afterEach(cleanup)

describe('TaskRow', () => {
  it('cannot be ticked until the new task has saved', () => {
    render(<TaskRow task={task('temp-123')} tz="UTC" now={new Date()} onToggle={() => {}} />)
    expect((screen.getByLabelText('Mark Essay done') as HTMLInputElement).disabled).toBe(true)
  })
  it('can be ticked once saved', () => {
    render(<TaskRow task={task('6b1c…')} tz="UTC" now={new Date()} onToggle={() => {}} />)
    expect((screen.getByLabelText('Mark Essay done') as HTMLInputElement).disabled).toBe(false)
  })
  it('flags a high priority task, in words for screen readers too', () => {
    render(<TaskRow task={{ ...task('6b1c'), priority: 'high' }} tz="UTC" now={new Date()} onToggle={() => {}} />)
    expect(screen.getByText('High priority')).toBeTruthy()
  })
  it('shows no flag for a normal task', () => {
    render(<TaskRow task={task('6b1c')} tz="UTC" now={new Date()} onToggle={() => {}} />)
    expect(screen.queryByText('High priority')).toBeNull()
  })
  it('opens the task for editing when its title is clicked', () => {
    let edited = 0
    render(<TaskRow task={task('6b1c')} tz="UTC" now={new Date()} onToggle={() => {}} onEdit={() => { edited++ }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Essay' }))
    expect(edited).toBe(1)
  })
  it('a task that is done shows ticked and unticking calls back', () => {
    let ticks = 0
    render(<TaskRow task={task('6b1c')} tz="UTC" now={new Date()} done onToggle={() => { ticks++ }} />)
    const box = screen.getByLabelText('Mark Essay done') as HTMLInputElement
    expect(box.checked).toBe(true)
    fireEvent.click(box)
    expect(ticks).toBe(1)
  })
})
