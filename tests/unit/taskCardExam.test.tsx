// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { TaskCard } from '@/components/planner/TaskCard'
import type { Task } from '@/lib/types'

afterEach(cleanup)
const now = new Date('2026-11-02T09:00:00Z')
const base: Task = { id: 't', course_id: null, title: 'Biology midterm', type: 'exam', due_at: '2026-11-14T14:00:00Z', priority: 'normal', done_at: null, created_at: '' }
const show = (over: Partial<Task>) => render(<TaskCard task={{ ...base, ...over }} tz="Africa/Accra" now={now} onToggle={vi.fn()} onEdit={vi.fn()} onMove={vi.fn()} />)

describe('TaskCard for an exam', () => {
  it('says when, how long and where, and how far away it is', () => {
    show({ duration_min: 120, location: 'Hall B' })
    expect(screen.getByText('Sat 14 Nov · 14:00 to 16:00 · Hall B')).toBeTruthy()
    expect(screen.getByText('in 12 days')).toBeTruthy()
  })
  it('says what it covers and what it counts for', () => {
    show({ covers: 'Chapters 1 to 5', weight_pct: 30 })
    expect(screen.getByText(/Chapters 1 to 5/)).toBeTruthy()
    expect(screen.getByText('30% of the grade')).toBeTruthy()
  })
  it('says the time is to be announced when it is not known', () => {
    show({ due_at: '2026-11-14T23:59:59Z' })
    expect(screen.getByText(/time to be announced/)).toBeTruthy()
  })
  it('leaves an ordinary task as it was', () => {
    show({ type: 'assignment', title: 'Essay', due_at: '2026-11-03T23:59:59Z' })
    expect(screen.getByText('Tomorrow')).toBeTruthy()
    expect(screen.queryByText(/in \d+ days/)).toBeNull()
  })
})
