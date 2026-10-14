import { describe, it, expect } from 'vitest'
import { listCounts, taskGroups, tasksForList } from '@/lib/tasks/lists'
import type { Task } from '@/lib/types'

const TZ = 'Africa/Accra' // UTC+0
const NOW = new Date('2026-10-14T10:00:00Z') // Wednesday
const task = (id: string, due: string | null, over: Partial<Task> = {}): Task =>
  ({ id, course_id: null, title: id, type: 'other', due_at: due, priority: 'normal', done_at: null, created_at: '', ...over })
const tasks = [
  task('late', '2026-10-12T23:59:59Z'), task('today', '2026-10-14T23:59:59Z'), task('tomorrow', '2026-10-15T23:59:59Z'),
  task('fri', '2026-10-16T23:59:59Z'), task('far', '2026-12-01T23:59:59Z'), task('none', null),
  task('done', '2026-10-14T23:59:59Z', { done_at: '2026-10-13T00:00:00Z' }),
]

describe('tasksForList', () => {
  const ids = (l: Parameters<typeof tasksForList>[0]) => tasksForList(l, tasks, TZ, NOW).map(t => t.id)
  it('All tasks: everything open, late first, then by date, then without a date', () => {
    expect(ids('all')).toEqual(['late', 'today', 'tomorrow', 'fri', 'far', 'none'])
  })
  it('Today: what is due today and what is late', () => { expect(ids('today')).toEqual(['late', 'today']) })
  it('Upcoming: dated tasks after today', () => { expect(ids('upcoming')).toEqual(['tomorrow', 'fri', 'far']) })
  it('Someday: tasks with no date', () => { expect(ids('someday')).toEqual(['none']) })
  it('Done is not made from open tasks', () => { expect(ids('done')).toEqual([]) })
})

describe('listCounts', () => {
  it('counts each list, with the done tasks given separately', () => {
    expect(listCounts(tasks, 4, TZ, NOW)).toEqual({ all: 6, today: 2, upcoming: 3, someday: 1, done: 4 })
  })
})

describe('taskGroups', () => {
  const groups = taskGroups(tasks.filter(t => !t.done_at), TZ, NOW)
  it('groups late tasks, then each day, then tasks with no date', () => {
    expect(groups.map(g => g.label)).toEqual(['Overdue', 'Today', 'Tomorrow', 'Fri, Oct 16', 'Tue, Dec 1', 'No date'])
  })
  it('keeps each task in its group, and marks Overdue as the one to look at', () => {
    expect(groups[0].tasks.map(t => t.id)).toEqual(['late'])
    expect(groups[0].tone).toBe('danger')
    expect(groups[1].tone).toBe('today')
    expect(groups[5].tasks.map(t => t.id)).toEqual(['none'])
  })
  it('puts two tasks due the same day in one group, high priority first', () => {
    const g = taskGroups([task('a', '2026-10-16T23:59:59Z'), task('b', '2026-10-16T23:59:59+00:00', { priority: 'high' })], TZ, NOW)
    expect(g).toHaveLength(1)
    expect(g[0].tasks.map(t => t.id)).toEqual(['b', 'a'])
  })
  it('is empty for no tasks', () => { expect(taskGroups([], TZ, NOW)).toEqual([]) })
})
