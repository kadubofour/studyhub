// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
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
})
